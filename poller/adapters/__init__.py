from collections.abc import Callable

from poller.adapters.ashby import fetch_ashby
from poller.adapters.greenhouse import fetch_greenhouse
from poller.adapters.lever import fetch_lever
from poller.models import Posting

ADAPTERS: dict[str, Callable[[str], list[Posting]]] = {
    "greenhouse": fetch_greenhouse,
    "lever": fetch_lever,
    "ashby": fetch_ashby,
}
