const UPDATE_FLAG = /^(-u|--update-snapshots(=.*)?)$/;

/**
 * Screenshot baselines are rendered in the pinned Playwright Linux container.
 * Refuse to write them anywhere else so fonts and anti-aliasing stay consistent.
 */
export function assertSnapshotUpdatePlatform(
  argv: readonly string[],
  platform: string,
): void {
  if (platform !== "linux" && argv.some((arg) => UPDATE_FLAG.test(arg))) {
    throw new Error(
      "Visual baselines are Linux-only: run the Visual baselines workflow or scripts/visual-baselines-docker.sh",
    );
  }
}
