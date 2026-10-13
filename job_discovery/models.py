from dataclasses import dataclass, field


@dataclass
class Posting:
    external_id: str
    title: str
    url: str
    location: str | None = None
    department: str | None = None
    remote: bool | None = None
    raw: dict = field(default_factory=dict)
    # False means positive availability only: fallback display is not source truth.
    metadata_complete: bool = True
