# Dashboard conventions

## Data boundaries: never `as`-cast a jsonb column

jsonb columns cross the DB boundary as `unknown`. postgres.js returns a jsonb **string
scalar** (from a double-encoded write) as a JS **string**, so an unvalidated
`row.some_json as SomeShape` cast can let a string reach React, where an unguarded
`.map` crashes the page (this happened: see the `application_packages` résumé crash).

Rules:
- Every jsonb read goes through a **total parser** that unwraps and validates, returning
  a valid typed value or `null` — never a bare `as` cast.
- Colocate parsers with the type they parse (see `lib/rolefit/packageCodec.ts`,
  `lib/rolefit/greenhouseQuestions.ts`, `lib/rolefit/boardFilters.ts`). No zod — hand-rolled
  total parsers are the house style.
- The same parser validates both the storage read AND the LLM/HTTP generation output, so
  "valid shape" has one definition and serialize/deserialize can't drift.
- Broaden the review heuristic: any `as SomeShape` on a value that crossed a process,
  network, or storage boundary is a claim needing evidence. The database is such a boundary
  — it replays data written by every past code version and every manual write.
