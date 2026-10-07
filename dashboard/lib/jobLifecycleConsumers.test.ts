import { describe, expect, it } from "vitest";
import { discoveryPredicate, parseJobLifecycle, lifecycleLabels, discoveryVisible } from "./jobLifecycle";
import { parseBoardFilters } from "./rolefit/boardFilters";
import { buildJobsQuery, buildJobsCountQuery } from "./jobsQuery";
import { serverBoardFilters } from "./filters";

const state = { feedEnabled: true, sourceEnabled: true, sourceAvailability: "open",
  discoveryAnchorAt: "2026-03-01T07:00:00.000Z", discoveryExpiresAt: "2026-03-31T07:00:00.000Z",
  payloadAvailability: "retired" };
describe("lifecycle consumers", () => {
  it("expires at exactly 720 elapsed UTC hours across DST, without implying closure", () => {
    const lifecycle = parseJobLifecycle(state)!;
    expect(discoveryVisible(lifecycle, false, "2026-03-31T06:59:59.999Z")).toBe(true);
    expect(discoveryVisible(lifecycle, false, "2026-03-31T07:00:00.000Z")).toBe(false);
    expect(discoveryVisible(lifecycle, true, "2026-03-31T07:00:00.000Z")).toBe(true);
    expect(lifecycleLabels(lifecycle, "2026-03-31T07:00:00.000Z")).toEqual(["Source open", "Discovery expired", "Posting payload retired"]);
  });
  it("distinguishes unknown and closed, and only opts into older confirmed live jobs", () => {
    for (const sourceAvailability of ["unknown", "closed"] as const) {
      const lifecycle = parseJobLifecycle({...state, sourceAvailability})!;
      expect(discoveryVisible(lifecycle, true, "2026-03-31T07:00:00.000Z")).toBe(false);
      expect(lifecycleLabels(lifecycle, "2026-03-31T07:00:00.000Z")[0]).toBe(`Source ${sourceAvailability}`);
    }
  });
  it("parses double encoded JSON and rejects malformed or incoherent boundaries", () => {
    expect(parseJobLifecycle(JSON.stringify(JSON.stringify(state)))).toEqual(state);
    for (const raw of [null, [], "{", 4, {...state, discoveryAnchorAt: "bad"}, {...state, sourceAvailability: "expired"}, {...state, discoveryExpiresAt: "2026-03-31T08:00:00Z"}]) expect(parseJobLifecycle(raw)).toBeNull();
    expect(parseBoardFilters(JSON.stringify(JSON.stringify({includeOlderLive:true})) ).includeOlderLive).toBe(true);
  });
  it("rows/count/page boundaries share one predicate and deterministic order", () => {
    const filters = {...serverBoardFilters("anon"), includeOlderLive:true};
    const rows = buildJobsQuery(filters, null, [], {limit:2,offset:2});
    const count = buildJobsCountQuery(filters,null);
    expect(rows.text).toContain(discoveryPredicate(true).text);
    expect(count.text).toContain(discoveryPredicate(true).text);
    expect(rows.text).toContain("j.id ASC");
    expect(rows.text).toContain("LIMIT 2\nOFFSET 2");
  });
  it("history queries require an owner and do not apply discovery or profile filters", () => {
    expect(() => buildJobsQuery(serverBoardFilters("anon"),null,[],{historyOnly:true})).toThrow();
    const query = buildJobsQuery(serverBoardFilters("authed"),"owner",[],{historyOnly:true,locationFromProfile:true,companyFiltersFromProfile:true});
    expect(query.text).toContain("application_packages");
    expect(query.text).not.toContain("lifecycle_discovery_visible");
    expect(query.text).not.toContain("preferred_locations");
    expect(query.text).not.toContain("company_exclusions");
  });
});

it('total-parses HTTP detail arrays and lifecycle instead of trusting legacy scalars',async()=>{
  const {parseJobDetailResponse}=await import('./jobPayloadNotice');
  const response=parseJobDetailResponse({benefits:'["Health",7]',red_flags:'broken',requirements:JSON.stringify(JSON.stringify([{text:'TypeScript',met:true},{text:4,met:true}])),lifecycle:JSON.stringify(state),questions:'broken',description:'Saved JD'});
  expect(response).toMatchObject({description:'Saved JD',benefits:['Health'],red_flags:null,requirements:[{text:'TypeScript',met:true}],lifecycle:state,questions:null});
});

it('closed filter uses proven source closure instead of discovery expiry',()=>{
  const query=buildJobsQuery({...serverBoardFilters('anon'),status:'closed'},null);
  expect(query.text).toContain('public.lifecycle_source_closed(j.id, j.closed_at)');
  expect(query.text).not.toContain('WHERE j.closed_at IS NOT NULL');
});

it('rejects timezone-free lifecycle dates rather than applying browser local time',()=>{
  expect(parseJobLifecycle({...state,discoveryAnchorAt:'2026-03-01T07:00:00',discoveryExpiresAt:'2026-03-31T07:00:00'})).toBeNull();
});
