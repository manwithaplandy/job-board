// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { RolefitBoard, type RolefitBoardProps } from "./RolefitBoard";
import { DEFAULT_FILTERS } from "@/lib/rolefit/filter";
import type { ApplicationPackage, JobRow } from "@/lib/types";

// Tier-gate upsell integration: a gated generation fetch that comes back 402/429 must
// surface the bottom-of-screen upsell pill with a /billing CTA (keyed off the status +
// the body's machine `code`, never the error string), while every other failure keeps
// the pre-existing generic error handling.

const { refresh } = vi.hoisted(() => ({refresh:vi.fn()}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const job: JobRow = {
  id: "job-1",
  title: "Staff Engineer",
  location: "Phoenix, AZ",
  location_canonicals: null,
  remote: true,
  first_seen_at: "2026-07-01T00:00:00.000Z",
  closed_at: null,
  company_name: "Acme",
  ats: "greenhouse",
  human_override: false,
  verdict: "approve",
  role_category: "engineering",
  seniority: "staff",
  work_arrangement: "remote",
  pay_min: 150000,
  pay_max: 200000,
  pay_currency: "USD",
  pay_period: "year",
  headcount: null,
  skills_score: 8,
  experience_score: 8,
  comp_score: 8,
  fit_score: 88,
  skill_gaps: [],
};

const baseProps: RolefitBoardProps = {
  jobs: [job],
  nowIso: "2026-07-04T00:00:00.000Z",
  isAuthed: true,
  initialFilters: DEFAULT_FILTERS,
  saveResume: vi.fn(async () => {}),
  rejectJob: vi.fn(async () => {}),
  unrejectJob: vi.fn(async () => {}),
  markApplied: vi.fn(async () => {}),
  unmarkApplied: vi.fn(async () => {}),
  hasProfile: true,
  viewerEmail: "u@x.com",
  resumeText: "resume text",
  currentProfileVersion: null,
  initialPackages: [],
  initialRejected: [],
};

// The board reads window.matchMedia through useSyncExternalStore; jsdom has none.
function stubMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Route the board's fetches: the gated POST answers with `prepare`; the polling GETs
// (review status, job detail) answer benignly so the detail pane settles.
function mockFetch(prepare: { status: number; body: Record<string, unknown> }) {
  global.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u === "/api/application/prepare" && init?.method === "POST") {
      return {
        ok: prepare.status < 400,
        status: prepare.status,
        json: async () => prepare.body,
      };
    }
    if (u.startsWith("/api/jobs/")) return { ok: true, status: 200, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ status: null }) };
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  refresh.mockClear();
  stubMatchMedia();
  // Deep-link the fixture job so the detail pane (and its Prepare button) mounts.
  window.history.replaceState({}, "", "/?job=job-1");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

async function renderAndPrepare(status: number, body: Record<string, unknown>) {
  mockFetch({ status, body });
  render(<RolefitBoard {...baseProps} />);
  fireEvent.click(await screen.findByRole("button", { name: /Prefill application/ }));
}

describe("RolefitBoard — tier-gate upsell pill (/billing CTA)", () => {
  test("429 allowance_exhausted → monthly-limit message + Upgrade-to-Pro link; panes revert, no error state", async () => {
    await renderAndPrepare(429, {
      error: "Monthly résumé allowance used (30/30 on Standard).",
      code: "allowance_exhausted",
      plan: "standard",
    });
    const pill = await screen.findByTestId("upsell-notice");
    expect(within(pill).getByText(/Monthly résumé allowance used \(30\/30 on Standard\)\./)).toBeTruthy();
    expect(within(pill).getByText(/resets next month/)).toBeTruthy();
    const cta = within(pill).getByRole("link", { name: /Upgrade to Pro/ });
    expect(cta.getAttribute("href")).toBe("/billing");
    // The rejection is an upsell, not a failure: the pane reverts to idle (the Prepare
    // button is back) instead of entering the error state.
    expect(await screen.findByRole("button", { name: /Prefill application/ })).toBeTruthy();
    expect(screen.queryByText(/Couldn’t generate/)).toBeNull();
  });

  test("402 subscription_required → subscribe invitation with a See-plans link to /billing", async () => {
    await renderAndPrepare(402, {
      error: "Subscribe to generate résumés and cover letters.",
      code: "subscription_required",
    });
    const pill = await screen.findByTestId("upsell-notice");
    expect(within(pill).getByText(/Subscribe to generate résumés and cover letters\./)).toBeTruthy();
    const cta = within(pill).getByRole("link", { name: /See plans/ });
    expect(cta.getAttribute("href")).toBe("/billing");
  });

  test("a bare 429 (upstream rate limit, no gate code) stays on the generic error path", async () => {
    await renderAndPrepare(429, { error: "Rate limited — try again in a moment." });
    // The generic path surfaces the error in the panes — and NO upsell pill appears.
    expect((await screen.findAllByText(/Rate limited — try again in a moment\./)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("upsell-notice")).toBeNull();
  });

  test("a non-gate failure (502) keeps the generic error handling, no upsell pill", async () => {
    await renderAndPrepare(502, { error: "Generation failed — try again." });
    expect((await screen.findAllByText(/Generation failed — try again\./)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("upsell-notice")).toBeNull();
  });
});

describe("pay range filter wiring", () => {
  const lowPay: JobRow = { ...job, id: "job-2", title: "Junior Engineer", pay_min: 60000, pay_max: 80000 };

  test("a persisted range hides out-of-range jobs and labels the Pay pill", () => {
    stubMatchMedia();
    mockFetch({ status: 200, body: {} }); // benign: no generation is driven here
    const { container } = render(
      <RolefitBoard
        {...baseProps}
        jobs={[job, lowPay]}
        initialFilters={{ ...DEFAULT_FILTERS, payMin: 100, payMax: null }}
      />,
    );
    // Load-bearing: the FilterBar result-count is layout-independent (unlike the virtualized
    // JobList, which renders no card rows in jsdom, and the auto-selected detail pane). It
    // reads `visibleCount of totalInView roles` where visibleCount is the count AFTER the pay
    // filter — so "1 of 2" proves the payMin:100 filter actually dropped the 60–80k job.
    expect(container.querySelector(".rf-board-result-count")?.textContent).toBe("1 of 2 roles");
    // Pay trigger reflects the active lower bound.
    expect(screen.getByRole("button", { name: /Pay.*\$100k\+/ })).toBeTruthy();
  });
});

test("hydration pending clears generation busy state and keeps retry available",async()=>{
  await renderAndPrepare(202,{payload:{status:"pending",id:"d"},message:"Job details are being prepared. Try again shortly."});
  expect(await screen.findByText("Job details are being prepared. Try again shortly.")).toBeTruthy();
  expect(await screen.findByRole("button",{name:/Prefill application/})).toBeTruthy();
});

for (const cached of ["Older shared JD", null]) {
  test(`ready current detail reaches the visible JD and question panel over ${cached}`, async () => {
    global.fetch = vi.fn(async () => ({ok:true,status:200,json:async()=>({
      description:cached, descriptionIsSaved:false, currentDescription:"Hydrated current JD",
      questions:null,currentQuestions:{questions:[{label:"Hydrated current question",required:false,fields:[{name:"answer",type:"input_text",options:[]}]}]},
    })})) as unknown as typeof fetch;
    render(<RolefitBoard {...baseProps} jobs={[{...job,fit_score:cached === null ? null : job.fit_score}]} />);
    fireEvent.click(await screen.findByRole("button", {name:/Show full job description/}));
    expect(await screen.findByText("Hydrated current JD")).toBeTruthy();
    if (cached === null) fireEvent.click(await screen.findByText("Current application questions"));
    else fireEvent.click(await screen.findByRole("button", {name:/Application questions/}));
    expect(await screen.findByText("Hydrated current question")).toBeTruthy();
  });
}
test("current posting is visible separately from saved review JD and saved package answers", async () => {
  global.fetch = vi.fn(async () => ({ok:true,status:200,json:async()=>({
    description:"Saved review JD",descriptionIsSaved:true,currentDescription:"Current employer JD",
    hasSavedAnswers:true,savedQuestions:{questions:[{label:"Saved Q",required:false,fields:[{name:"answer",type:"input_text",options:[]}]}]},
    questions:null,currentQuestions:{questions:[{label:"Current Q",required:false,fields:[{name:"answer",type:"input_text",options:[]}]}]},
  })})) as unknown as typeof fetch;
  render(<RolefitBoard {...baseProps} initialPackages={[{
    jobId:job.id,status:"prepared",descriptionSnapshot:"Saved application JD",questionsSnapshot:{questions:[{label:"Saved Q",required:false,fields:[{name:"answer",type:"input_text",options:[]}]}]},resume:null,coverLetter:null,prefilledAnswers:[{question:"Saved Q",answer:"Saved answer"}],
    applyUrl:null,profileVersion:null,resumeInstructions:null,coverLetterInstructions:null,
    resumeInstructionsDraft:null,coverLetterInstructionsDraft:null,coverLetterEditedText:null,
    preparedAt:baseProps.nowIso,appliedAt:null,
  }]} />);
  fireEvent.click(await screen.findByRole("button", {name:/Show full job description/}));
  expect(await screen.findByText("Current employer JD")).toBeTruthy();
  expect(await screen.findByText("Saved review description")).toBeTruthy();
  expect(await screen.findByText("Saved review JD")).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", {name:/Application questions/}));
  const answer=await screen.findByText("Saved answer");
  const savedPanel=answer.closest(".rf-generation-panel");
  if (!(savedPanel instanceof HTMLElement)) throw new Error("saved answer panel missing");
  expect(within(savedPanel).queryByText("Current Q")).toBeNull();
  expect(await screen.findByText("Saved application JD")).toBeTruthy();
  expect(await screen.findByText("Current application questions")).toBeTruthy();
  expect(await screen.findByText("Current Q")).toBeTruthy();
});

test('discovery hides expired rows until older-live opt-in, and labels availability separately', async () => {
  stubMatchMedia(); window.history.replaceState({},'', '/');
  vi.spyOn(window,'matchMedia').mockImplementation(query => ({matches:true,media:query,onchange:null,addEventListener:()=>{},removeEventListener:()=>{},dispatchEvent:()=>false,addListener:()=>{},removeListener:()=>{}}));
  mockFetch({status:200,body:{}});
  render(<RolefitBoard {...baseProps} isAuthed={false} jobs={[{...job,lifecycle:{feedEnabled:true,sourceEnabled:true,sourceAvailability:'open',discoveryAnchorAt:'2026-06-01T00:00:00.000Z',discoveryExpiresAt:'2026-07-01T00:00:00.000Z',payloadAvailability:'retired'}}]} />);
  expect(screen.queryByText('Staff Engineer')).toBeNull();
  fireEvent.click(screen.getByRole('checkbox',{name:'Include older live jobs'}));
  expect(await screen.findByText('Staff Engineer')).toBeTruthy();
  expect(screen.getByText('Discovery expired')).toBeTruthy();
  expect(screen.getByText('Source open')).toBeTruthy();
});

test('history retains a closed saved job independently of discovery and its totals', async () => {
  stubMatchMedia(); window.history.replaceState({},'', '/');
  vi.spyOn(window,'matchMedia').mockImplementation(query => ({matches:true,media:query,onchange:null,addEventListener:()=>{},removeEventListener:()=>{},dispatchEvent:()=>false,addListener:()=>{},removeListener:()=>{}}));
  mockFetch({status:200,body:{}});
  const saved={...job,id:'saved',title:'Saved Role',closed_at:'2026-07-01T00:00:00Z',lifecycle:{feedEnabled:true,sourceEnabled:true,sourceAvailability:'closed' as const,discoveryAnchorAt:'2026-06-01T00:00:00.000Z',discoveryExpiresAt:'2026-07-01T00:00:00.000Z',payloadAvailability:'retired' as const}};
  render(<RolefitBoard {...baseProps} initialHistory={[saved]} />);
  expect(screen.queryByText('Saved Role')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'History'}));
  expect(await screen.findByText('Saved Role')).toBeTruthy();
  expect(screen.getByText('Source closed')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Saved Role/}));
  expect(await screen.findByRole('heading',{name:'Saved Role',level:1})).toBeTruthy();
});

function savedPackage(jobId:string): ApplicationPackage {
  return {jobId,status:"applied",resume:null,coverLetter:null,prefilledAnswers:null,
    applyUrl:null,profileVersion:null,resumeInstructions:null,coverLetterInstructions:null,
    resumeInstructionsDraft:null,coverLetterInstructionsDraft:null,coverLetterEditedText:null,
    preparedAt:baseProps.nowIso,appliedAt:baseProps.nowIso};
}

test('selected history page contains only its 500 server rows, including the applied view', async () => {
  window.history.replaceState({},'', '/?historyPage=1');
  vi.spyOn(window,'matchMedia').mockImplementation(query => ({matches:true,media:query,onchange:null,addEventListener:()=>{},removeEventListener:()=>{},dispatchEvent:()=>false,addListener:()=>{},removeListener:()=>{}}));
  mockFetch({status:200,body:{}});
  const discovery=Array.from({length:500},(_,i)=>({...job,id:`discovery-${i}`,title:`Discovery role ${i}`}));
  const history=Array.from({length:500},(_,i)=>({...job,id:`history-${i}`,title:`History role ${i}`}));
  const {container}=render(<RolefitBoard {...baseProps} jobs={discovery} initialHistory={history}
    historyTotal={1000} historyPage={1} initialPackages={[...discovery,...history].map(j=>savedPackage(j.id))}/>);
  fireEvent.click(screen.getByRole('button',{name:'History'}));
  const titles=()=>[...container.querySelectorAll('.rf-job-card__title')].map(node=>node.textContent);
  expect(titles()).toHaveLength(500);
  expect(new Set(titles())).toEqual(new Set(history.map(j=>j.title)));
  expect(container.querySelector('.rf-board-result-count')?.textContent).toBe('500 of 500 roles');
  expect(screen.getByText(/1000 saved jobs · Page 2/)).toBeTruthy();
  fireEvent.click(screen.getByRole('radio',{name:'Applied · 500'}));
  expect(titles()).toHaveLength(500);
  expect(new Set(titles())).toEqual(new Set(history.map(j=>j.title)));
  expect(container.querySelector('.rf-board-result-count')?.textContent).toBe('500 of 500 roles');
},20000);

test('newly saved application refreshes the selected bounded history page without merging discovery', async () => {
  mockFetch({status:200,body:{}});
  const {container,rerender}=render(<RolefitBoard {...baseProps} initialHistory={[]} historyTotal={0}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Mark as applied'}));
  await waitFor(()=>expect(refresh).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button',{name:'History'}));
  expect(container.querySelectorAll('.rf-job-card__title')).toHaveLength(0);
  rerender(<RolefitBoard {...baseProps} initialHistory={[job]} historyTotal={1}/>);
  expect(container.querySelector('.rf-board-result-count')?.textContent).toBe('1 of 1 roles');
});
