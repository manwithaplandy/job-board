# discovery/__main__.py
import logging

from discovery.run import run


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    try:
        run()
    finally:
        from observability import tracing
        tracing.flush()


if __name__ == "__main__":
    main()
