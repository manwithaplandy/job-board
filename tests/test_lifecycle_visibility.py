"""Ordinary set-based visibility equivalence; no adversarial mechanism probes."""
import itertools

from tests.conftest import requires_db


@requires_db
def test_bulk_visibility_matches_scalar_predicates_across_rollout_flags(conn):
    conn.execute("INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','visibility')")
    conn.execute("""INSERT INTO jobs(id,company_id,external_id,title,url,closed_at)
        SELECT id,1,id,'Engineer','https://example.test/'||id,closed_at
        FROM (VALUES ('unmapped',NULL::timestamptz),('legacy-closed',now()),
          ('fresh',NULL),('expired',NULL),('unknown',NULL),('closed',NULL),
          ('mixed',now()),('boundary',NULL),('fresh-unknown',NULL),
          ('multiple-live',NULL)) t(id,closed_at)""")
    source = conn.execute("""INSERT INTO source_accounts(ats,public_board_ref)
        VALUES('lever','visibility') RETURNING id""").fetchone()['id']
    conn.execute("""INSERT INTO source_listings(source_account_id,external_id,job_id,
        original_discovered_at,discovery_anchor_at,discovery_anchor_provenance,
        discovery_expires_at,source_availability)
        SELECT %s,external_id,job_id,now()-age,now()-age,'local_observation',
          now()-age+interval '720 hours',availability
        FROM (VALUES
          ('fresh','fresh',interval '1 hour','open'),
          ('expired','expired',interval '721 hours','open'),
          ('unknown','unknown',interval '721 hours','unknown'),
          ('closed','closed',interval '1 hour','closed'),
          ('mixed-closed','mixed',interval '1 hour','closed'),
          ('mixed-open','mixed',interval '1 hour','open'),
          ('boundary','boundary',interval '720 hours','open'),
          ('fresh-unknown','fresh-unknown',interval '1 hour','unknown'),
          ('multiple-fresh','multiple-live',interval '1 hour','open'),
          ('multiple-expired','multiple-live',interval '721 hours','open')
        ) t(external_id,job_id,age,availability)""", (source,))
    for feed, source_enabled in itertools.product((False, True), repeat=2):
        conn.execute("""UPDATE lifecycle_control SET feed_enabled=%s,source_enabled=%s,
            activation_generation=activation_generation+1""", (feed, source_enabled))
        for older in (False, True, None):
            result = conn.execute("""SELECT count(*) AS total,
                bool_and(v.discovery_visible IS NOT DISTINCT FROM
                  public.lifecycle_discovery_visible(j.id,j.closed_at,%s)) AS discovery_matches,
                bool_and(v.source_closed IS NOT DISTINCT FROM
                  public.lifecycle_source_closed(j.id,j.closed_at)) AS closure_matches
                FROM public.lifecycle_job_visibility(%s) v JOIN jobs j ON j.id=v.job_id
                """, (older, older)).fetchone()
            assert result == {'total': 10, 'discovery_matches': True, 'closure_matches': True}
    # The two source listings for mixed must yield one result, including count paths.
    assert conn.execute("""SELECT count(*) AS n FROM public.lifecycle_job_visibility(false)
        WHERE job_id='mixed' AND discovery_visible""").fetchone()['n'] == 1
