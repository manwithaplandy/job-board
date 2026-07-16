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

export async function acquireLoginFormWithRetry(
  acquire: () => Promise<void>,
  reload: () => Promise<unknown>,
  captureFinalFailure: () => Promise<void>,
  evidenceTimeoutMs: number,
): Promise<void> {
  try {
    await acquire();
  } catch {
    await reload();
    try {
      await acquire();
    } catch (primaryError) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const capture = Promise.resolve()
        .then(captureFinalFailure)
        .catch(() => undefined);
      const deadline = new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, evidenceTimeoutMs);
      });
      try {
        await Promise.race([capture, deadline]);
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
      throw primaryError;
    }
  }
}

export type VisualAuthIdentity = "established" | "onboarding";
export type VisualAuthPhase =
  | "open-login"
  | "render-form"
  | "fill-form"
  | "submit-click"
  | "authentication-rejected"
  | "authentication-outcome"
  | "verify-established-redemption"
  | "verify-onboarding-redemption"
  | "render-profile"
  | "persist-state"
  | "cleanup";

export type VisualAuthNetworkEvent = {
  method: string;
  pathname: string;
  status: number | "failed";
};

export type VisualAuthStructure = {
  forms: number;
  inputs: number;
  buttons: number;
  headings: number;
};

function safePathname(raw: string): string {
  try {
    return new URL(raw, "https://redacted.invalid").pathname || "/";
  } catch {
    return "/invalid";
  }
}

export function formatVisualAuthDiagnostic({
  identity,
  phase,
  currentUrl,
  network,
  structure,
}: {
  identity: VisualAuthIdentity;
  phase: VisualAuthPhase;
  currentUrl: string;
  network: VisualAuthNetworkEvent[];
  structure?: VisualAuthStructure;
}): string {
  const events = network.slice(-12).map(({ method, pathname, status }) => {
    const safeMethod = /^[A-Z]+$/.test(method) ? method : "UNKNOWN";
    return `${safeMethod} ${safePathname(pathname)} ${status}`;
  });
  return [
    "Visual authentication failed:",
    `identity=${identity}`,
    `phase=${phase}`,
    `path=${safePathname(currentUrl)}`,
    `network=[${events.join(", ") || "none"}]`,
    structure
      ? `structure=[forms=${structure.forms} inputs=${structure.inputs} buttons=${structure.buttons} headings=${structure.headings}]`
      : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

export function readVercelProtectionBypassHeaders(env: Env) {
  const secret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret) {
    throw new Error("VERCEL_AUTOMATION_BYPASS_SECRET is required");
  }

  return {
    "x-vercel-protection-bypass": secret,
    "x-vercel-set-bypass-cookie": "true",
    "x-vercel-skip-toolbar": "1",
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
