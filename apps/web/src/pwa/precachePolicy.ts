interface Chunk {
  file: string;
  name?: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
  assets?: string[];
}

/** Stable offline shell/curriculum only. Never traverse dynamic route imports. */
export function stablePrecacheFiles(manifest: Record<string, Chunk>): Set<string> {
  const files = new Set<string>();
  const visited = new Set<string>();
  const visit = (key: string) => {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing precache dependency: ${key}`);
    files.add(chunk.file);
    for (const file of [...(chunk.css ?? []), ...(chunk.assets ?? [])]) files.add(file);
    for (const dependency of chunk.imports ?? []) visit(dependency);
  };
  for (const [key, chunk] of Object.entries(manifest)) {
    if (
      chunk.isEntry ||
      /(?:^|\/)(?:CommandCenter|AcademyUnit|SyncScreen)\.tsx$/.test(key) ||
      key.includes('virtual:bloomlab-unit/')
    )
      visit(key);
  }
  if (![...files].some((file) => /\/index-.*\.js$/.test(file)))
    throw new Error('Offline shell entry missing');
  if ([...files].some((file) => /WorkflowLab-|simulator\.worker-/.test(file)))
    throw new Error('Heavy Workflow asset leaked into stable precache');
  return files;
}
