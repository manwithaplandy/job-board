import type { ReactNode } from "react";
import { safeHttpUrl } from "@/lib/rolefit/applyUrl";

/**
 * A job's posting link for the workspace pages. The URL comes from the database (scraped
 * ATS data); only an http: or https: URL becomes a link, otherwise the title renders as
 * plain text with the same id (rows use it as their accessible name).
 */
export function JobLink({ url, id, children }: { url: string; id?: string; children: ReactNode }) {
  const href = safeHttpUrl(url);
  if (href === null) return <span id={id}>{children}</span>;
  return (
    <a id={id} className="rf-secondary-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
