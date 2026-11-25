// When a stored surface may be shown in the variant 3 sandbox (fix round 1, I5). The Task
// 2.8 host mounts SandboxFrame only when canMountSandbox passes (plan note R15); any other
// row shows its stored variant 1 fallback through BlockList.
//
// Client-safe: a type-only import of the store, and the document module's validator
// (which imports only zod, sha256 and the kit tokens).
import type { StoredSurface } from "@/lib/agent/surfaces/store";
import { validateSurfaceV3 } from "@/lib/agent/surfaces/v3/document";

export type MountableRow = Pick<StoredSurface, "variant" | "outcome" | "failure" | "payload" | "fallbackPayload">;

/**
 * True only for a variant 3 row whose outcome is not fallback, with no failure recorded,
 * a stored fallback payload to fall back to, and a payload that passes the variant 3
 * validator (schema and static checks) now, not only when it was saved.
 */
export function canMountSandbox(row: MountableRow | null | undefined): boolean {
  if (!row || row.variant !== 3) return false;
  if (row.outcome === "fallback" || row.failure !== null) return false;
  if (row.fallbackPayload === null || typeof row.fallbackPayload !== "object") return false;
  return validateSurfaceV3(row.payload).ok;
}
