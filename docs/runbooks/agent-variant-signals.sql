-- Agent variant production signals (plan Task 2.13, spec 7.3). Read-only; run by hand
-- with a read-only role once the variants have real traffic. Supporting information for
-- the variant decision, not a gate; the numbers are not copied into the summary
-- (docs/superpowers/plans/2026-11-20-variant-summary.md).
--
-- One result set per signal, each per variant, over the window set in `params` (30 days).
-- Eval runs (agent_runs.kind = 'eval') are left out wherever a row names its run.
-- Column names are as in schema.sql: agent_threads, agent_messages, agent_runs,
-- agent_surfaces, agent_actions, shortlist_items, applications, application_events.
--
-- The last two signals are proxies, and say so in their comments: the app records no
-- "opened a workspace" event, and a re-asked question is matched on normalized text.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

-- 1. Fallback rate: surfaces that fell back to the variant 1 blocks, and that needed a
--    repair, per rendered variant.
WITH params AS (SELECT now() - interval '30 days' AS since)
SELECT s.variant,
       count(*) AS surfaces,
       count(*) FILTER (WHERE s.outcome = 'fallback') AS fell_back,
       round(count(*) FILTER (WHERE s.outcome = 'fallback')::numeric / nullif(count(*), 0), 4) AS fallback_rate,
       round(count(*) FILTER (WHERE s.outcome = 'repaired')::numeric / nullif(count(*), 0), 4) AS repair_rate
FROM public.agent_surfaces s
LEFT JOIN public.agent_runs r ON r.id = s.run_id
CROSS JOIN params p
WHERE s.created_at >= p.since
  AND (r.id IS NULL OR r.kind <> 'eval')
GROUP BY s.variant
ORDER BY s.variant;

-- 2. "Re-render as" use: per variant a surface was first shown in, how many were
--    re-rendered, and into which variant.
WITH params AS (SELECT now() - interval '30 days' AS since),
originals AS (
  SELECT s.id, s.variant
  FROM public.agent_surfaces s
  LEFT JOIN public.agent_runs r ON r.id = s.run_id
  CROSS JOIN params p
  WHERE s.created_at >= p.since AND s.rerender_of IS NULL
    AND (r.id IS NULL OR r.kind <> 'eval')
)
SELECT o.variant AS shown_in,
       count(DISTINCT o.id) AS surfaces,
       count(DISTINCT o.id) FILTER (WHERE rr.id IS NOT NULL) AS re_rendered,
       round(count(DISTINCT o.id) FILTER (WHERE rr.id IS NOT NULL)::numeric / nullif(count(DISTINCT o.id), 0), 4) AS rerender_rate,
       count(rr.id) FILTER (WHERE rr.variant = 1) AS into_v1,
       count(rr.id) FILTER (WHERE rr.variant = 2) AS into_v2,
       count(rr.id) FILTER (WHERE rr.variant = 3) AS into_v3
FROM originals o
LEFT JOIN public.agent_surfaces rr ON rr.rerender_of = o.id
GROUP BY o.variant
ORDER BY o.variant;

-- 3. Undo within 60 seconds of an agent action, per variant of the run that made it.
WITH params AS (SELECT now() - interval '30 days' AS since)
SELECT r.variant,
       count(*) AS agent_actions,
       count(*) FILTER (WHERE a.undone_at IS NOT NULL AND a.undone_at - a.created_at <= interval '60 seconds') AS undone_within_60s,
       round(count(*) FILTER (WHERE a.undone_at IS NOT NULL AND a.undone_at - a.created_at <= interval '60 seconds')::numeric
             / nullif(count(*), 0), 4) AS undo_60s_rate
FROM public.agent_actions a
JOIN public.agent_runs r ON r.id = a.run_id
CROSS JOIN params p
WHERE a.created_at >= p.since
  AND a.actor IN ('agent', 'agent_unattended')
  AND r.kind <> 'eval'
GROUP BY r.variant
ORDER BY r.variant;

-- 4. The same question asked again in a thread (proxy): a user message whose text,
--    lower-cased with spaces collapsed, equals an earlier user message in the same thread
--    within 30 minutes. Credited to the variant of the interactive run that answered the
--    earlier message (the first one started between the two).
WITH params AS (SELECT now() - interval '30 days' AS since),
asks AS (
  SELECT m.thread_id, m.seq, m.created_at,
         lower(regexp_replace(trim(coalesce((
           SELECT string_agg(part ->> 'text', ' ')
           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.parts) = 'array' THEN m.parts ELSE '[]'::jsonb END) AS part
           WHERE part ->> 'type' = 'text'
         ), '')), '\s+', ' ', 'g')) AS text
  FROM public.agent_messages m
  CROSS JOIN params p
  WHERE m.role = 'user' AND m.created_at >= p.since
),
answered AS (
  SELECT a.thread_id, a.seq, a.created_at, a.text,
         (SELECT r.variant FROM public.agent_runs r
          WHERE r.thread_id = a.thread_id AND r.kind = 'interactive' AND r.created_at >= a.created_at
          ORDER BY r.created_at LIMIT 1) AS variant
  FROM asks a
  WHERE a.text <> ''
)
SELECT x.variant,
       count(*) AS user_messages,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM answered y
         WHERE y.thread_id = x.thread_id AND y.seq > x.seq AND y.text = x.text
           AND y.created_at - x.created_at <= interval '30 minutes'
       )) AS asked_again,
       round(count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM answered y
         WHERE y.thread_id = x.thread_id AND y.seq > x.seq AND y.text = x.text
           AND y.created_at - x.created_at <= interval '30 minutes'
       ))::numeric / nullif(count(*), 0), 4) AS asked_again_rate
FROM answered x
WHERE x.variant IS NOT NULL
GROUP BY x.variant
ORDER BY x.variant;

-- 5. A surface left for a workspace (proxy): after a surface from an interactive run, the
--    user changed a shortlist entry or an application in a workspace within 10 minutes,
--    and sent no message in that thread in between. A workspace change is a shortlist
--    row the user set, or an application event the user made, with no matching
--    'user_via_surface' action (a press on a surface) within 5 seconds for that job.
--    shortlist_items keeps only its latest update, so this undercounts.
WITH params AS (SELECT now() - interval '30 days' AS since),
surfaces AS (
  SELECT s.id, s.user_id, s.thread_id, s.variant, s.created_at
  FROM public.agent_surfaces s
  JOIN public.agent_runs r ON r.id = s.run_id
  CROSS JOIN params p
  WHERE s.created_at >= p.since AND r.kind = 'interactive'
),
workspace_changes AS (
  SELECT si.user_id, si.job_id, si.updated_at AS at
  FROM public.shortlist_items si
  CROSS JOIN params p
  WHERE si.set_by = 'user' AND si.updated_at >= p.since
  UNION ALL
  SELECT e.user_id, ap.job_id, e.created_at AS at
  FROM public.application_events e
  JOIN public.applications ap ON ap.id = e.application_id
  CROSS JOIN params p
  WHERE e.actor = 'user' AND e.created_at >= p.since
),
by_hand AS (
  SELECT w.*
  FROM workspace_changes w
  WHERE NOT EXISTS (
    SELECT 1 FROM public.agent_actions a
    WHERE a.user_id = w.user_id AND a.actor = 'user_via_surface'
      AND a.target_key ->> 'jobId' = w.job_id
      AND a.created_at BETWEEN w.at - interval '5 seconds' AND w.at + interval '5 seconds'
  )
)
SELECT s.variant,
       count(*) AS surfaces,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM by_hand h
         WHERE h.user_id = s.user_id AND h.at > s.created_at AND h.at <= s.created_at + interval '10 minutes'
           AND NOT EXISTS (
             SELECT 1 FROM public.agent_messages m
             WHERE m.thread_id = s.thread_id AND m.role = 'user' AND m.created_at > s.created_at AND m.created_at < h.at
           )
       )) AS left_for_workspace,
       round(count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM by_hand h
         WHERE h.user_id = s.user_id AND h.at > s.created_at AND h.at <= s.created_at + interval '10 minutes'
           AND NOT EXISTS (
             SELECT 1 FROM public.agent_messages m
             WHERE m.thread_id = s.thread_id AND m.role = 'user' AND m.created_at > s.created_at AND m.created_at < h.at
           )
       ))::numeric / nullif(count(*), 0), 4) AS left_rate
FROM surfaces s
GROUP BY s.variant
ORDER BY s.variant;

COMMIT;
