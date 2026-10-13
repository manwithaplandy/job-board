"""Ordinary feed candidate semantics; excludes the deliberately omitted mechanism review."""
import pytest
from reviewer import db as rdb

pytestmark = pytest.mark.usefixtures("conn")
USER = "11111111-1111-1111-1111-111111111111"


def test_feed_flags_candidates_and_counts(conn):
    conn.execute("INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','fixture')")
    conn.execute("INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('old',1,'1','Role','https://example.test/job')")
    source = conn.execute("INSERT INTO source_accounts(ats,public_board_ref) VALUES('lever','fixture') RETURNING id").fetchone()['id']
    conn.execute("""INSERT INTO source_listings(source_account_id,external_id,job_id,original_discovered_at,
      discovery_anchor_at,discovery_anchor_provenance,discovery_expires_at,source_availability)
      VALUES(%s,'1','old',now()-interval '721 hours',now()-interval '721 hours','local_observation',now()-interval '1 hour','open')""", (source,))
    conn.commit()
    rows, count = rdb.select_candidates(conn, USER, 'v1', 1)
    assert [r['id'] for r in rows] == ['old'] and count == 1
    conn.execute("UPDATE lifecycle_control SET feed_enabled=true,activation_generation=activation_generation+1")
    rows, count = rdb.select_candidates(conn, USER, 'v1', 1)
    assert rows == [] and count == 0
    conn.execute("UPDATE lifecycle_control SET feed_enabled=false,activation_generation=activation_generation+1")
    rows, count = rdb.select_candidates(conn, USER, 'v1', 1)
    assert len(rows) == count == 1


def test_candidate_count_and_rows_share_one_read_statement(conn):
    """A candidate page and its total must use one statement-time boundary."""
    from contextlib import contextmanager

    conn.execute("INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','fixture')")
    conn.execute("INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('fresh',1,'1','Role','https://example.test/job')")
    conn.commit()
    candidate_reads = []

    class RecordedConnection:
        def __getattr__(self, name):
            return getattr(conn, name)

        @contextmanager
        def cursor(self, *args, **kwargs):
            with conn.cursor(*args, **kwargs) as cursor:
                class RecordedCursor:
                    def __getattr__(self, name):
                        return getattr(cursor, name)

                    def execute(self, query, params=None):
                        if "FROM jobs j" in query:
                            candidate_reads.append(query)
                        return cursor.execute(query, params)

                yield RecordedCursor()

    rows, count = rdb.select_candidates(RecordedConnection(), USER, 'v1', 1)
    assert [row['id'] for row in rows] == ['fresh'] and count == 1
    assert len(candidate_reads) == 1
    assert '_candidate_first_seen' not in rows[0]
