import logging

from poller import db
from reviewer.run import review_all


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    conn = db.connect()
    try:
        review_all(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
