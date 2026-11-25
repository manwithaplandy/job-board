// The structured compare message (plan Tasks 1.14 and 1.20): what the `compare` intent
// and the agent page's ?compare=a,b both send. Client-safe: no imports.

export function compareMessage(a: string, b: string): string {
  return `Compare these two jobs: ${a} and ${b}.`;
}
