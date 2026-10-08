# Exhaustive selection boundaries

The JSON allowlist is authoritative. This inventory explains every Python test file outside its whole-file selection and every dashboard DB file. It does not execute or review excluded mechanisms. Other default dashboard unit files use the committed Vitest default selection.

| File | Scope/reason |
| --- | --- |
| `tests/test_archive_batches.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_archive_fix1.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_archive_fix2.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_archive_outbox.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_archive_privacy.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_archive_recovery_authorization.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_archive_replay.py` | Only exact named positive nodes in JSON selected; all sibling nodes excluded because mixed ordinary and mechanism/privilege/concurrency coverage. No sibling assurance claimed. |
| `tests/test_archive_retention_recovery.py` | Only exact named positive nodes in JSON selected; all sibling nodes excluded because mixed ordinary and mechanism/privilege/concurrency coverage. No sibling assurance claimed. |
| `tests/test_classification_jobs_db.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_classification_worker.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_company_discovery_db.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_company_discovery_llm.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_company_discovery_run.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_company_enrich.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_company_schema.py` | Only exact named positive nodes in JSON selected; all sibling nodes excluded because mixed ordinary and mechanism/privilege/concurrency coverage. No sibling assurance claimed. |
| `tests/test_db_job_questions.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_db_jobs.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_entitlements.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_experiments.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_http.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_lifecycle_activation.py` | Entire file excluded: explicit omitted independent mechanism/security scope. |
| `tests/test_lifecycle_company_boundaries.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_lifecycle_identity.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_lifecycle_legacy_spool.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_lifecycle_maintenance.py` | Only exact named positive nodes in JSON selected; all sibling nodes excluded because mixed ordinary and mechanism/privilege/concurrency coverage. No sibling assurance claimed. |
| `tests/test_lifecycle_migrations.py` | Only exact named positive nodes in JSON selected; all sibling nodes excluded because mixed ordinary and mechanism/privilege/concurrency coverage. No sibling assurance claimed. |
| `tests/test_lifecycle_operational.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_lifecycle_reconcile.py` | Only exact named positive nodes in JSON selected; all sibling nodes excluded because mixed ordinary and mechanism/privilege/concurrency coverage. No sibling assurance claimed. |
| `tests/test_lifecycle_relations.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_lifecycle_review_security.py` | Entire file excluded: explicit omitted independent mechanism/security scope. |
| `tests/test_lifecycle_safety.py` | Entire file excluded: explicit omitted independent mechanism/security scope. |
| `tests/test_lifecycle_service_order.py` | Entire file excluded: explicit omitted independent mechanism/security scope. |
| `tests/test_lifecycle_test_db.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_llm.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_locations_resolution.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_locations_schema.py` | Only exact named positive nodes in JSON selected; all sibling nodes excluded because mixed ordinary and mechanism/privilege/concurrency coverage. No sibling assurance claimed. |
| `tests/test_maintenance_controlflow.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_matching_inactivity.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_metadata_migration_grants.py` | Entire file excluded: explicit omitted independent mechanism/security scope. |
| `tests/test_prune.py` | Not selected for final execution: accepted earlier task scope retained historically; mixed lifecycle/physical/claim/concurrency or redundant mechanisms are not rerun. No current whole-file pass claimed. |
| `tests/test_public_fetch.py` | Accepted Task8 shared transport evidence retained historically; do not reimplement or repeat covered transport/adversarial work in Task13. Ordinary adapter mocks do not replace it. |
| `tests/test_resume_storage_policies.py` | Entire file excluded: explicit omitted independent mechanism/security scope. |
| `tests/test_reviewer_db.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_reviewer_llm.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_reviewer_run.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_reviewer_worker.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_rls_isolation.py` | Entire file excluded: explicit omitted independent mechanism/security scope. |
| `tests/test_run.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_schema.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_serp.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_size_guard.py` | Physical guard scope excluded from this final lane; do not use it as a substitute for omitted capacity assurance. |
| `tests/test_spend_alert.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_subscription_ordering.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_tracing.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_weekly_ingest_retry.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `tests/test_workday.py` | Outside the inspected ordinary final allowlist; unrelated/baseline regression not executed by this final lane. No current pass claimed. |
| `dashboard/lib/accountDeletion.feedback.db.test.ts` | Excluded from default and owned lane: mixed cross-owner/erasure/privilege/gate/constraint or shared-target assumptions; do not repoint or reproduce. |
| `dashboard/lib/feedback.db.test.ts` | Excluded from default and owned lane: mixed cross-owner/erasure/privilege/gate/constraint or shared-target assumptions; do not repoint or reproduce. |
| `dashboard/lib/jobLifecycle.db.test.ts` | Excluded from default and owned lane: mixed cross-owner/erasure/privilege/gate/constraint or shared-target assumptions; do not repoint or reproduce. |
| `dashboard/lib/jobLifecycle.flow.db.test.ts` | Selected only through strict owned lane, sequentially; default excluded. |
| `dashboard/lib/jobLifecycleConsumers.db.test.ts` | Selected only through strict owned lane, sequentially; default excluded. |
| `dashboard/lib/profileSettings.db.test.ts` | Unselected baseline ordinary DB regression: opt-in TEST_DATABASE_URL fixture, outside the committed two-file owned lane. Default excludes all DB suites, so no silent required skip/pass claim; this file is not labelled an omitted security suite. |
| `dashboard/lib/queries.boardInclude.db.test.ts` | Unselected baseline ordinary DB regression: opt-in TEST_DATABASE_URL fixture, outside the committed two-file owned lane. Default excludes all DB suites, so no silent required skip/pass claim; this file is not labelled an omitted security suite. |
| `dashboard/lib/queries.boardLocationScoping.db.test.ts` | Unselected baseline ordinary DB regression: opt-in TEST_DATABASE_URL fixture, outside the committed two-file owned lane. Default excludes all DB suites, so no silent required skip/pass claim; this file is not labelled an omitted security suite. |
| `dashboard/lib/queries.locationScoping.db.test.ts` | Unselected baseline ordinary DB regression: opt-in TEST_DATABASE_URL fixture, outside the committed two-file owned lane. Default excludes all DB suites, so no silent required skip/pass claim; this file is not labelled an omitted security suite. |
| `dashboard/lib/queries.saveBoardFilters.db.test.ts` | Unselected baseline ordinary DB regression: opt-in TEST_DATABASE_URL fixture, outside the committed two-file owned lane. Default excludes all DB suites, so no silent required skip/pass claim; this file is not labelled an omitted security suite. |
