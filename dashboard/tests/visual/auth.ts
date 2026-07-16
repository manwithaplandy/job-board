import path from "node:path";

export const VISUAL_AUTH_DIR = path.resolve(
  process.cwd(),
  "test-results/visual-auth",
);
export const ESTABLISHED_STATE_PATH = path.join(
  VISUAL_AUTH_DIR,
  "established.json",
);
export const ONBOARDING_STATE_PATH = path.join(
  VISUAL_AUTH_DIR,
  "onboarding.json",
);

type Env = Record<string, string | undefined>;

export function readVercelProtectionBypassHeaders(env: Env) {
  const secret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret) {
    throw new Error("VERCEL_AUTOMATION_BYPASS_SECRET is required");
  }

  return {
    "x-vercel-protection-bypass": secret,
    "x-vercel-set-bypass-cookie": "true",
  };
}

export function readVisualCredentials(env: Env) {
  const names = [
    "VISUAL_AUTH_EMAIL",
    "VISUAL_AUTH_PASSWORD",
    "VISUAL_ONBOARDING_EMAIL",
    "VISUAL_ONBOARDING_PASSWORD",
  ] as const;

  for (const name of names) {
    if (!env[name]) throw new Error(`${name} is required`);
  }

  return {
    established: {
      email: env.VISUAL_AUTH_EMAIL!,
      password: env.VISUAL_AUTH_PASSWORD!,
    },
    onboarding: {
      email: env.VISUAL_ONBOARDING_EMAIL!,
      password: env.VISUAL_ONBOARDING_PASSWORD!,
    },
  };
}

export function validateVisualBaseUrl(raw: string | undefined): string {
  if (!raw) throw new Error("VISUAL_BASE_URL is required");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("VISUAL_BASE_URL must be an HTTPS Vercel Preview URL");
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".vercel.app") ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== ""
  ) {
    throw new Error("VISUAL_BASE_URL must be an HTTPS Vercel Preview URL");
  }

  return url.origin;
}
