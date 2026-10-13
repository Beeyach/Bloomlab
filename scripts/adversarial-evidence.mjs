// Vitest reports forward slashes even when the host resolves native Windows paths.
export function findReportFile(files, expectedPath) {
  const normalized = expectedPath.replaceAll('\\', '/');
  return files.find((file) => file.name.replaceAll('\\', '/') === normalized);
}
