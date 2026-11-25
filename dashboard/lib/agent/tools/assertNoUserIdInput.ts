// Test helper (plan Global Constraints: no tool accepts a user id). Walks every tool's
// input JSON schema, nested objects and arrays included, and throws on any property
// whose name reads as a user id (userId, user_id, userID, user-id, ...). The caller's
// identity always comes from ToolCtx, never from model-supplied input.
import { asSchema, type Tool } from "ai";

const USER_ID_KEY = /user.?id/i;

function walk(node: unknown, path: string, found: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((child, i) => walk(child, `${path}[${i}]`, found));
    return;
  }
  if (typeof node !== "object" || node === null) return;
  for (const [key, child] of Object.entries(node)) {
    if (key === "properties" && typeof child === "object" && child !== null) {
      for (const name of Object.keys(child)) {
        if (USER_ID_KEY.test(name)) found.push(`${path}.${name}`);
      }
    }
    walk(child, `${path}.${key}`, found);
  }
}

export async function assertNoUserIdInput(tools: Record<string, Tool>): Promise<void> {
  const found: string[] = [];
  for (const [name, t] of Object.entries(tools)) {
    if (!t.inputSchema) continue;
    const json = await asSchema(t.inputSchema).jsonSchema;
    walk(json, name, found);
  }
  if (found.length > 0) {
    throw new Error(`tool input schema has a user id field: ${found.join(", ")}`);
  }
}
