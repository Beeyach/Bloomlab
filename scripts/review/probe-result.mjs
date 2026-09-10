/** A diagnostic report must fail its process when evidence failed, even after cleanup succeeded. */
export function probeExitCode(report) {
  return report?.ok === true && !report.error ? 0 : 1;
}
