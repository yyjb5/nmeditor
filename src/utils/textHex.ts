export type HexApplyRange = {
  start: number;
  bytes: number[];
};

export function toHexByte(value: number): string {
  const normalized = Math.max(0, Math.min(255, value | 0));
  return normalized.toString(16).toUpperCase().padStart(2, "0");
}

export function parseHexByte(input: string): number | null {
  const raw = input.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{1,2}$/.test(raw)) return null;
  const value = Number.parseInt(raw, 16);
  if (!Number.isFinite(value) || value < 0 || value > 255) return null;
  return value;
}

export function isPrintableAscii(value: number): boolean {
  return value >= 0x20 && value <= 0x7e;
}

export function buildHexApplyRanges(
  source: Uint8Array,
  edits: Record<number, number>,
): HexApplyRange[] {
  const entries = Object.entries(edits)
    .map(([index, value]) => ({
      index: Number.parseInt(index, 10),
      value,
    }))
    .filter(
      (entry) =>
        Number.isFinite(entry.index) &&
        entry.index >= 0 &&
        entry.index < source.length &&
        Number.isFinite(entry.value) &&
        entry.value >= 0 &&
        entry.value <= 255,
    )
    .sort((a, b) => a.index - b.index);

  if (!entries.length) return [];
  const ranges: HexApplyRange[] = [];
  let start = entries[0].index;
  let end = start;
  let bytes: number[] = [entries[0].value];

  for (let i = 1; i < entries.length; i += 1) {
    const current = entries[i];
    if (current.index === end + 1) {
      end = current.index;
      bytes.push(current.value);
      continue;
    }
    ranges.push({ start, bytes });
    start = current.index;
    end = current.index;
    bytes = [current.value];
  }
  ranges.push({ start, bytes });
  return ranges;
}
