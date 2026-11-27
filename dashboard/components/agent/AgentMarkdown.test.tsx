// @vitest-environment jsdom
// The assistant's markdown renderer: structure is drawn, and the spec's "no model-authored
// links or images" control holds (no <a>, no <img>, no raw HTML).
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AgentMarkdown } from "./AgentMarkdown";

afterEach(cleanup);

test("headings, lists, bold, inline code and tables are drawn as elements", () => {
  const { container } = render(
    <AgentMarkdown
      text={"## Direct PM role\n\n- **SuperDial**, fit 63\n- Nymbus\n\n1. one\n2. two\n\nUse `fit` scores.\n\n| Job | Fit |\n|---|---|\n| A | 92 |"}
    />,
  );
  expect(container.querySelector("h2")?.textContent).toBe("Direct PM role");
  expect(container.querySelectorAll("ul > li")).toHaveLength(2);
  expect(container.querySelector("strong")?.textContent).toBe("SuperDial");
  expect(container.querySelectorAll("ol > li")).toHaveLength(2);
  expect(container.querySelector("code")?.textContent).toBe("fit");
  expect(container.querySelector(".rf-md__table-wrap table td")?.textContent).toBe("A");
  // No raw markdown marks are left in the text.
  expect(container.textContent).not.toContain("**");
  expect(container.textContent).not.toContain("## ");
});

test("links render as plain text with no href, bare URLs included", () => {
  const { container } = render(
    <AgentMarkdown text={"See [the posting](https://evil.example/x?c=secret) or https://evil.example/y and <https://evil.example/z>."} />,
  );
  expect(container.querySelector("a")).toBeNull();
  expect(container.querySelector("[href]")).toBeNull();
  expect(container.textContent).toContain("the posting");
});

test("images are never requested: only their alt text shows", () => {
  const { container } = render(<AgentMarkdown text={"![resume leak](https://evil.example/p.png?d=abc) and ![](https://evil.example/q.png)"} />);
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("[src]")).toBeNull();
  expect(container.textContent).toContain("resume leak");
  expect(container.textContent).not.toContain("evil.example");
});

test("raw HTML is dropped, never parsed", () => {
  const { container } = render(
    <AgentMarkdown text={'Hello <b>bold</b> <img src="https://evil.example/r.png"> <script>alert(1)</script><iframe src="https://evil.example"></iframe>'} />,
  );
  expect(container.querySelector("b, img, script, iframe")).toBeNull();
  expect(container.innerHTML).not.toContain("evil.example");
});
