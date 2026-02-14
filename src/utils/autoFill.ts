type DateSeriesMeta = { startMs: number; stepMs: number };
type NumberSeriesMeta = { start: number; step: number };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseNumberSeries(values: string[]): NumberSeriesMeta | null {
  if (values.length < 2) return null;
  const parsed = values.map((value) => Number(value.trim()));
  if (parsed.some((value) => !Number.isFinite(value))) return null;
  return { start: parsed[0], step: parsed[1] - parsed[0] };
}

function parseIsoDate(value: string): number | null {
  const match = value.trim().match(DATE_RE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

function parseDateSeries(values: string[]): DateSeriesMeta | null {
  if (values.length < 2) return null;
  const parsed = values.map(parseIsoDate);
  if (parsed.some((value) => value === null)) return null;
  const first = parsed[0] as number;
  const second = parsed[1] as number;
  return { startMs: first, stepMs: second - first };
}

function formatIsoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function createAutoFillValueGetter(sourceValues: string[][]) {
  const rowCount = Math.max(sourceValues.length, 1);
  const colCount = Math.max(sourceValues[0]?.length ?? 0, 1);

  const verticalSeriesValues =
    colCount === 1 ? sourceValues.map((row) => row[0] ?? "") : null;
  const horizontalSeriesValues =
    rowCount === 1 ? sourceValues[0]?.map((value) => value ?? "") ?? null : null;

  const verticalNumberSeries = verticalSeriesValues
    ? parseNumberSeries(verticalSeriesValues)
    : null;
  const horizontalNumberSeries = horizontalSeriesValues
    ? parseNumberSeries(horizontalSeriesValues)
    : null;
  const verticalDateSeries = verticalSeriesValues
    ? parseDateSeries(verticalSeriesValues)
    : null;
  const horizontalDateSeries = horizontalSeriesValues
    ? parseDateSeries(horizontalSeriesValues)
    : null;

  const mod = (value: number, size: number) => {
    const next = value % size;
    return next < 0 ? next + size : next;
  };

  return (rowOffset: number, colOffset: number): string => {
    if (colCount === 1) {
      if (verticalNumberSeries) {
        return String(verticalNumberSeries.start + verticalNumberSeries.step * rowOffset);
      }
      if (verticalDateSeries) {
        return formatIsoDate(verticalDateSeries.startMs + verticalDateSeries.stepMs * rowOffset);
      }
    }

    if (rowCount === 1) {
      if (horizontalNumberSeries) {
        return String(horizontalNumberSeries.start + horizontalNumberSeries.step * colOffset);
      }
      if (horizontalDateSeries) {
        return formatIsoDate(horizontalDateSeries.startMs + horizontalDateSeries.stepMs * colOffset);
      }
    }

    const templateRow = mod(rowOffset, rowCount);
    const templateCol = mod(colOffset, colCount);
    return sourceValues[templateRow]?.[templateCol] ?? "";
  };
}
