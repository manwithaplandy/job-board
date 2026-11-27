import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// The assistant's text, drawn as markdown (headings, lists, bold, tables, code) so an
// answer reads cleanly instead of showing raw "-" and "**" marks (Andrew 2026-11-27).
//
// The spec's control "No model-authored links or images" (05-redesign-spec.md, section 10)
// still holds, so this renderer can't become an exfiltration path:
// - raw HTML in the text is dropped (skipHtml), never parsed or injected;
// - a link renders as its plain text with no href, so nothing is clickable or prefetched;
// - an image renders as nothing but its alt text, so no request is ever made for it;
// - every URL the parser keeps is blanked by urlTransform as a second guard.
// Everything is built as React elements by react-markdown; there is no dangerouslySetInnerHTML.

const components: Components = {
  a: ({ children }) => <span className="rf-md__link-text">{children}</span>,
  img: ({ alt }) => (alt ? <span className="rf-md__img-alt">{alt}</span> : null),
  // A table can be wider than a phone; it scrolls inside its own box, never the page.
  table: ({ children }) => (
    <div className="rf-md__table-wrap">
      <table>{children}</table>
    </div>
  ),
};

const noUrl = () => "";

export function AgentMarkdown({ text }: { text: string }): ReactNode {
  return (
    <div className="rf-md rf-agent-message__text">
      <Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={noUrl} components={components}>
        {text}
      </Markdown>
    </div>
  );
}
