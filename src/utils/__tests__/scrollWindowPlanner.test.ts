import { describe, expect, it } from "vitest";
import { planWindowRequestForScroll } from "../scrollWindowPlanner";

describe("planWindowRequestForScroll", () => {
  it("keeps jump request when dragging far below loaded window even during loading", () => {
    const plan = planWindowRequestForScroll({
      scrollTop: 13000,
      viewHeight: 600,
      rowHeight: 30,
      windowStart: 0,
      rowsLength: 400,
      effectiveTotalRows: 50000,
      eof: false,
      loadingInProgress: true,
    });

    expect(plan.kind).toBe("jump");
    if (plan.kind === "jump") {
      expect(plan.direction).toBe("down");
      expect(plan.start).toBeGreaterThan(0);
    }
  });

  it("blocks edge auto-next when loading and not far from current window", () => {
    const plan = planWindowRequestForScroll({
      scrollTop: 11200,
      viewHeight: 600,
      rowHeight: 30,
      windowStart: 0,
      rowsLength: 400,
      effectiveTotalRows: 50000,
      eof: false,
      loadingInProgress: true,
    });

    expect(plan).toEqual({ kind: "none", reason: "loading" });
  });

  it("clamps jump start to valid upper bound", () => {
    const plan = planWindowRequestForScroll({
      scrollTop: 999999,
      viewHeight: 800,
      rowHeight: 28,
      windowStart: 0,
      rowsLength: 400,
      effectiveTotalRows: 1000,
      eof: false,
      loadingInProgress: false,
    });

    expect(plan.kind).toBe("jump");
    if (plan.kind === "jump") {
      expect(plan.start).toBe(600);
    }
  });
});
