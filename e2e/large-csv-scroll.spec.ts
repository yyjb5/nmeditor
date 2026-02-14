import { expect, test } from "@playwright/test";

const TOTAL_ROWS = 12_000;
const COLUMN_COUNT = 8;
const WINDOW_LIMIT = 400;

const buildRow = (row: number): string[] =>
  new Array(COLUMN_COUNT).fill("").map((_, col) => {
    if (col === 0) return `${row}`;
    if (col === 1) return `name-${row}`;
    return `r${row}-c${col}`;
  });

test("large CSV remains populated after continuous scroll and scrollbar jump", async ({ page }) => {
  await page.addInitScript(({ totalRows, columnCount, windowLimit }) => {
    const header = new Array(columnCount).fill("").map((_, idx) => `c${idx}`);
    const build = (row: number): string[] =>
      new Array(columnCount).fill("").map((_, col) => {
        if (col === 0) return `${row}`;
        if (col === 1) return `name-${row}`;
        return `r${row}-c${col}`;
      });

    let indexJobCreated = false;
    (window as unknown as { __NMEDITOR_BRIDGE__?: unknown }).__NMEDITOR_BRIDGE__ = {
      openDialog: async () => "mock-large.csv",
      saveDialog: async () => null,
      statFile: async () => ({ size: 450 * 1024 * 1024 }),
      invoke: async (command: string, args?: Record<string, unknown>) => {
        if (command === "set_menu_locale") return null;
        if (command === "open_csv_session") {
          return {
            session_id: 1,
            headers: header,
            delimiter: typeof args?.delimiter === "string" ? args.delimiter : ",",
            path: typeof args?.path === "string" ? args.path : "mock-large.csv",
          };
        }
        if (command === "read_csv_rows_window") {
          const start = Number(args?.start ?? 0);
          const limit = Number(args?.limit ?? windowLimit);
          const safeStart = Math.max(0, Math.min(totalRows, start));
          const safeLimit = Math.max(1, Math.min(windowLimit, limit));
          const end = Math.min(totalRows, safeStart + safeLimit);
          const rows: string[][] = [];
          for (let i = safeStart; i < end; i += 1) {
            rows.push(build(i));
          }
          return {
            rows,
            start: safeStart,
            end,
            eof: end >= totalRows,
          };
        }
        if (command === "start_prepare_csv_index") {
          indexJobCreated = true;
          return { job_id: 99 };
        }
        if (command === "get_prepare_csv_index_status") {
          return {
            job_id: 99,
            progress: indexJobCreated ? 1 : 0,
            done: true,
            canceled: false,
            total_rows: totalRows,
          };
        }
        if (command === "cancel_prepare_csv_index") return null;
        if (command === "release_global_view") return null;
        if (command === "close_csv_session") return null;
        throw new Error(`Unhandled invoke command in e2e mock: ${command}`);
      },
    };
  }, { totalRows: TOTAL_ROWS, columnCount: COLUMN_COUNT, windowLimit: WINDOW_LIMIT });

  await page.goto("/");
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("nmeditor:menu-event", { detail: "file_open" }));
  });

  const gridBody = page.locator(".grid-body");
  await expect(gridBody).toBeVisible();

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll(".grid-row"));
        if (!rows.length) return false;
        return rows.some((row) => {
          const cell = row.querySelector(".cell:not(.row-header)");
          if (!cell) return false;
          return (cell.textContent ?? "").trim().length > 0;
        });
      });
    })
    .toBe(true);

  for (let i = 0; i < 6; i += 1) {
    await gridBody.evaluate((el, step) => {
      el.scrollTop += step;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    }, 1200);
    await page.waitForTimeout(160);
  }

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const rowHeaders = Array.from(document.querySelectorAll(".grid-row .row-header"))
          .map((node) => Number((node.textContent ?? "").trim()))
          .filter((n) => Number.isFinite(n));
        if (!rowHeaders.length) return false;
        return Math.max(...rowHeaders) > 200;
      });
    })
    .toBe(true);

  await gridBody.evaluate((el) => {
    el.scrollTop = Math.max(el.scrollHeight * 0.82, 0);
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.waitForTimeout(260);

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const rowHeaders = Array.from(document.querySelectorAll(".grid-row .row-header"))
          .map((node) => Number((node.textContent ?? "").trim()))
          .filter((n) => Number.isFinite(n));
        if (!rowHeaders.length) return false;
        return Math.max(...rowHeaders) > 1000;
      });
    })
    .toBe(true);

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll(".grid-row"));
        if (!rows.length) return false;
        return rows.some((row) => {
          const cell = row.querySelector(".cell:not(.row-header)");
          if (!cell) return false;
          const text = (cell.textContent ?? "").trim();
          return text.length > 0;
        });
      });
    })
    .toBe(true);
});

test("row builder sanity", () => {
  expect(buildRow(2)[1]).toBe("name-2");
});
