import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { performance } from "node:perf_hooks";
import os from "node:os";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function toNumber(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function generateCsv(filePath, rows, cols) {
  await ensureDir(path.dirname(filePath));
  const stream = fs.createWriteStream(filePath, { encoding: "utf8" });
  const write = async (line) => {
    if (stream.write(line)) return;
    await new Promise((resolve) => stream.once("drain", resolve));
  };

  const headers = [];
  for (let c = 0; c < cols; c += 1) headers.push(`c${c}`);
  await write(`${headers.join(",")}\n`);

  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < cols; c += 1) {
      let value = "";
      if (c === 0) value = `id_${r}`;
      else if (c === 1) value = r % 97 === 0 ? "needle" : `v${r % 1000}`;
      else if (c === 2) value = String((r * 17) % 100000);
      else value = `r${r}_c${c}`;
      row.push(value);
    }
    await write(`${row.join(",")}\n`);
  }

  await new Promise((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });
}

async function streamDataRows(filePath, onRow) {
  const input = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let isHeader = true;
  let rowIndex = 0;
  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    const keepGoing = await onRow(line.split(","), rowIndex);
    rowIndex += 1;
    if (keepGoing === false) break;
  }
  rl.close();
}

async function measure(fn) {
  const start = performance.now();
  const payload = await fn();
  const ms = Number((performance.now() - start).toFixed(2));
  return { ms, ...payload };
}

async function countRows(filePath) {
  let total = 0;
  await streamDataRows(filePath, async () => {
    total += 1;
    return true;
  });
  return { total };
}

async function readWindow(filePath, startRow, limit) {
  const rows = [];
  await streamDataRows(filePath, async (cells, idx) => {
    if (idx < startRow) return true;
    rows.push(cells);
    if (rows.length >= limit) return false;
    return true;
  });
  return { loaded: rows.length, startRow, limit };
}

async function findMatches(filePath, needle, maxMatches = 2000) {
  let scanned = 0;
  let matched = 0;
  let hasMore = false;
  await streamDataRows(filePath, async (cells) => {
    scanned += 1;
    let rowMatched = false;
    for (const value of cells) {
      if (value.includes(needle)) {
        rowMatched = true;
        break;
      }
    }
    if (!rowMatched) return true;
    matched += 1;
    if (matched > maxMatches) {
      hasMore = true;
      return false;
    }
    return true;
  });
  return { scanned, matched: Math.min(matched, maxMatches), hasMore };
}

async function filterAndSort(filePath) {
  const picked = [];
  await streamDataRows(filePath, async (cells) => {
    if ((cells[1] || "").startsWith("v1")) {
      picked.push({
        k: Number(cells[2] || 0),
        row: cells,
      });
    }
    return true;
  });
  picked.sort((a, b) => a.k - b.k);
  return { kept: picked.length };
}

function flattenMetrics(result) {
  return {
    countRows: result.metrics.countRows.ms,
    windowHead: result.metrics.windows.head.ms,
    windowMiddle: result.metrics.windows.middle.ms,
    windowTail: result.metrics.windows.tail.ms,
    find: result.metrics.find.ms,
    filterSort: result.metrics.filterSort.ms,
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const rows = Math.max(1000, Math.floor(toNumber(args.rows, 200000)));
  const cols = Math.max(4, Math.floor(toNumber(args.cols, 12)));
  const windowSize = Math.max(100, Math.floor(toNumber(args.window, 2000)));
  const tolerance = Math.max(0, toNumber(args.tolerance, 0.35));
  const baselinePath = path.resolve(
    root,
    String(args.baseline || "perf/baseline.large_csv.json"),
  );
  const outPath = path.resolve(root, String(args.out || "perf/latest.large_csv.json"));
  const datasetPath = path.resolve(
    root,
    String(args.dataset || `perf/generated/large_${rows}x${cols}.csv`),
  );
  const shouldCheck = Boolean(args.check);
  const shouldRegenerate = Boolean(args.regenerate);
  const shouldUpdateBaseline = Boolean(args["update-baseline"]);

  await ensureDir(path.dirname(datasetPath));
  await ensureDir(path.dirname(outPath));
  if (shouldRegenerate || !fs.existsSync(datasetPath)) {
    console.log(`[perf] generating dataset: ${datasetPath}`);
    await generateCsv(datasetPath, rows, cols);
  }

  const metrics = {
    countRows: await measure(() => countRows(datasetPath)),
    windows: {
      head: await measure(() => readWindow(datasetPath, 0, windowSize)),
      middle: await measure(() => readWindow(datasetPath, Math.floor(rows / 2), windowSize)),
      tail: await measure(() =>
        readWindow(datasetPath, Math.max(rows - windowSize, 0), windowSize),
      ),
    },
    find: await measure(() => findMatches(datasetPath, "needle", 2000)),
    filterSort: await measure(() => filterAndSort(datasetPath)),
  };

  const result = {
    generatedAt: new Date().toISOString(),
    machine: { platform: os.platform(), release: os.release(), cpus: os.cpus().length },
    config: { rows, cols, windowSize, datasetPath: path.relative(root, datasetPath) },
    metrics,
  };

  await fsp.writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`[perf] wrote: ${outPath}`);
  console.table(flattenMetrics(result));

  if (shouldUpdateBaseline) {
    await ensureDir(path.dirname(baselinePath));
    await fsp.writeFile(baselinePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`[perf] baseline updated: ${baselinePath}`);
  }

  if (!shouldCheck) return;
  if (!fs.existsSync(baselinePath)) {
    console.error(`[perf] baseline not found: ${baselinePath}`);
    process.exit(2);
  }

  const baseline = JSON.parse(await fsp.readFile(baselinePath, "utf8"));
  const currentFlat = flattenMetrics(result);
  const baselineFlat = flattenMetrics(baseline);
  const regressions = [];
  const minBaselineMs = Math.max(20, toNumber(args["min-baseline-ms"], 20));
  const minDeltaMs = Math.max(10, toNumber(args["min-delta-ms"], 10));
  for (const [name, currentMs] of Object.entries(currentFlat)) {
    const baseMs = baselineFlat[name];
    if (typeof baseMs !== "number" || !Number.isFinite(baseMs) || baseMs <= 0) continue;
    if (baseMs < minBaselineMs) continue;
    const ratio = currentMs / baseMs;
    const delta = currentMs - baseMs;
    if (ratio > 1 + tolerance && delta >= minDeltaMs) {
      regressions.push({
        metric: name,
        baselineMs: Number(baseMs.toFixed(2)),
        currentMs: Number(currentMs.toFixed(2)),
        deltaMs: Number(delta.toFixed(2)),
        ratio: Number(ratio.toFixed(2)),
      });
    }
  }

  if (!regressions.length) {
    console.log(`[perf] check passed (tolerance ${(tolerance * 100).toFixed(0)}%)`);
    return;
  }

  console.error(`[perf] regression detected (tolerance ${(tolerance * 100).toFixed(0)}%)`);
  console.table(regressions);
  process.exit(1);
}

run().catch((err) => {
  console.error("[perf] failed:", err);
  process.exit(1);
});
