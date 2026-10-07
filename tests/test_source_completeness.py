"""Malformed successful HTTP bodies must never authorize closure."""
import pytest
from job_discovery.adapters import greenhouse, ashby, workable, smartrecruiters, workday


@pytest.mark.parametrize("module,key", [(greenhouse,"jobs"), (ashby,"jobs"), (workable,"jobs"), (smartrecruiters,"content"), (workday,"jobPostings")])
def test_null_collection_is_not_empty_source(monkeypatch, module, key):
    monkeypatch.setattr(module, "post_json" if module is workday else "get_json", lambda *a, **k: {key: None})
    fetch = getattr(module, "fetch_" + module.__name__.rsplit(".", 1)[1])
    with pytest.raises(ValueError):
        list(fetch("a:wd5:External" if module is workday else "a"))


@pytest.mark.parametrize("module,key,id_key", [(greenhouse,"jobs","id"), (ashby,"jobs","id"), (workable,"jobs","shortcode")])
def test_unidentifiable_entry_cannot_authorize_closure(monkeypatch, module, key, id_key):
    monkeypatch.setattr(module, "get_json", lambda *a: {key: [{id_key: None, "title": "A", "absolute_url": "u"}]})
    fetch = getattr(module, "fetch_" + module.__name__.rsplit(".", 1)[1])
    with pytest.raises(ValueError):
        fetch("a")


def test_greenhouse_reported_total_cannot_exceed_collection(monkeypatch):
    monkeypatch.setattr(greenhouse, "get_json", lambda *a: {"jobs": [], "meta": {"total": 7}})
    with pytest.raises(ValueError):
        greenhouse.fetch_greenhouse("a")


@pytest.mark.parametrize('name', ['greenhouse','lever','ashby','workable','smartrecruiters','workday'])
def test_every_family_requires_exhaustion_for_empty_success(monkeypatch,name):
    from job_discovery import http
    from job_discovery.adapters import ADAPTERS
    from job_discovery.adapters.completeness import SourceResult
    bodies={'greenhouse':{'jobs':[]},'lever':[],'ashby':{'jobs':[]},
            'workable':{'jobs':[]},'smartrecruiters':{'content':[],'totalFound':0},
            'workday':{'jobPostings':[],'total':0}}
    monkeypatch.setattr(http,'get_json',lambda *a,**kw:bodies[name])
    monkeypatch.setattr(http,'post_json',lambda *a,**kw:bodies[name])
    result=ADAPTERS[name]('fixture:wd5:External' if name=='workday' else 'fixture',fetch_details=False)
    assert isinstance(result,SourceResult) and not result.complete
    assert list(result)==[] and result.complete


@pytest.mark.parametrize('name,key,id_key', [('greenhouse','jobs','id'),('lever',None,'id'),('ashby','jobs','id'),('workable','jobs','shortcode')])
def test_single_response_duplicate_identity_never_complete(monkeypatch,name,key,id_key):
    from job_discovery import http
    from job_discovery.adapters import ADAPTERS
    items=[{id_key:'same'},{id_key:'same'}]
    monkeypatch.setattr(http,'get_json',lambda *a,**kw:{key:items} if key else items)
    with pytest.raises(ValueError,match='duplicate'):
        list(ADAPTERS[name]('fixture'))


@pytest.mark.parametrize('family',['smartrecruiters','workday'])
def test_final_page_failure_preserves_yielded_positive_but_never_completes(monkeypatch,family):
    from job_discovery import http
    from job_discovery.adapters import ADAPTERS
    module=smartrecruiters if family=='smartrecruiters' else workday
    monkeypatch.setattr(module,'_PAGE_LIMIT',1)
    calls=[]
    def page(*a,**kw):
        calls.append(1)
        if len(calls)>1:
            raise ValueError('fixture final page failed')
        return {'content':[{'id':'one','name':'Role'}],'totalFound':2} if family=='smartrecruiters' else {'jobPostings':[{'externalPath':'one','title':'Role'}],'total':2}
    monkeypatch.setattr(http,'get_json',page)
    monkeypatch.setattr(http,'post_json',page)
    feed=ADAPTERS[family]('fixture:wd5:External' if family=='workday' else 'fixture',fetch_details=False)
    assert next(feed).external_id=='one'
    with pytest.raises(ValueError,match='final page'):
        list(feed)
    assert not feed.complete


@pytest.mark.parametrize('family',['smartrecruiters','workday'])
def test_changed_total_cannot_certify_absence(monkeypatch,family):
    from job_discovery import http
    from job_discovery.adapters import ADAPTERS
    module=smartrecruiters if family=='smartrecruiters' else workday
    monkeypatch.setattr(module,'_PAGE_LIMIT',1)
    if family=='smartrecruiters':
        pages=iter([{'content':[{'id':'one','name':'Role'}],'totalFound':2},
                    {'content':[{'id':'two','name':'Role'}],'totalFound':1}])
    else:
        pages=iter([{'jobPostings':[{'externalPath':'one','title':'Role'}],'total':2},
                    {'jobPostings':[],'total':0}])
    monkeypatch.setattr(http,'get_json',lambda *a,**kw:next(pages))
    monkeypatch.setattr(http,'post_json',lambda *a,**kw:next(pages))
    feed=ADAPTERS[family]('fixture:wd5:External' if family=='workday' else 'fixture',fetch_details=False)
    list(feed)
    assert not feed.complete


def test_board_time_budget_checked_between_postings_without_another_request(monkeypatch):
    from job_discovery.adapters import completeness as c
    from job_discovery.models import Posting
    clock=[0.0]
    monkeypatch.setattr(c,'monotonic',lambda:clock[0])
    with c.source_budget(10,2):
        feed=c.SourceResult(iter([Posting('one','Role','u'),Posting('two','Role','u')]),c.SourceStatus())
        next(feed)
        clock[0]=10
        with pytest.raises(c.SourceBudgetExceeded):
            next(feed)
        assert not feed.complete
