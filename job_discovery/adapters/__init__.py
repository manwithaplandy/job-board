from collections.abc import Callable

from job_discovery.adapters.ashby import fetch_ashby
from job_discovery.adapters.greenhouse import fetch_greenhouse
from job_discovery.adapters.lever import fetch_lever
from job_discovery.models import Posting

ADAPTERS: dict[str, Callable[[str], list[Posting]]] = {
    "greenhouse": fetch_greenhouse,
    "lever": fetch_lever,
    "ashby": fetch_ashby,
}
