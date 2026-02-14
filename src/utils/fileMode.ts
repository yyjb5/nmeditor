const CSV_EXTENSIONS = [".csv", ".tsv", ".psv", ".ssv"];

export function isCsvLikePath(path: string): boolean {
  const normalized = path.trim().toLowerCase();
  return CSV_EXTENSIONS.some((ext) => normalized.endsWith(ext));
}

