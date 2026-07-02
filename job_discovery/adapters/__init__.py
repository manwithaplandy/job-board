from collections.abc import Callable, Iterable

from job_discovery.adapters.ashby import fetch_ashby
from job_discovery.adapters.greenhouse import fetch_greenhouse
from job_discovery.adapters.lever import fetch_lever
from job_discovery.adapters.smartrecruiters import fetch_smartrecruiters
from job_discovery.adapters.workable import fetch_workable
from job_discovery.adapters.workday import fetch_workday
from job_discovery.models import Posting

# Adapters return an Iterable (list or generator); run.py iterates with `for`.
ADAPTERS: dict[str, Callable[[str], Iterable[Posting]]] = {
    "greenhouse": fetch_greenhouse,
    "lever": fetch_lever,
    "ashby": fetch_ashby,
    "workable": fetch_workable,
    "smartrecruiters": fetch_smartrecruiters,
    "workday": fetch_workday,
}
