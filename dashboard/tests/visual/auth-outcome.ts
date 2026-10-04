import type { Page } from "@playwright/test";
import { classifyVisualAuthRejection, type VisualAuthRejection } from "./auth";

const AUTH_OUTCOME_TIMEOUT_MS = 20_000;

type AuthenticationOutcome =
  | { status: "success" }
  | { status: "rejected"; classification: VisualAuthRejection }
  | { status: "timeout" | "closed" };

export async function waitForAuthenticationOutcome(
  page: Page,
  expectedURL: string,
): Promise<AuthenticationOutcome> {
  // Next's route announcer is also a visible role=alert in an open shadow root.
  // Only the login form's server-rendered error represents authentication rejection.
  const alert = page.locator("form").getByRole("alert");
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AuthenticationOutcome>((resolve) => {
    timeoutId = setTimeout(
      () => resolve({ status: "timeout" }),
      AUTH_OUTCOME_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([
      page
        .waitForURL(expectedURL, { waitUntil: "commit", timeout: 0 })
        .then(
          () => ({ status: "success" }) as const,
          () => ({ status: "closed" }) as const,
        ),
      alert
        .waitFor({ state: "visible", timeout: 0 })
        .then(
          async () => ({
            status: "rejected" as const,
            classification: classifyVisualAuthRejection(
              await alert.innerText(),
            ),
          }),
          () => ({ status: "closed" }) as const,
        )
        .catch(() => ({ status: "closed" }) as const),
      timeout,
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
