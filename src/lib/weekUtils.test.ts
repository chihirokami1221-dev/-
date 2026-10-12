import test from "node:test";
import assert from "node:assert/strict";
import { getStartOfWeek, getWeekLabel } from "./weekUtils";

test("weekUtils returns Monday as the start of the week", () => {
  const date = new Date("2026-10-08T12:00:00Z");
  const start = getStartOfWeek(date);

  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 9);
  assert.equal(start.getDate(), 5);
  assert.equal(start.getDay(), 1);
});

test("weekUtils formats a week label from start date to end date", () => {
  const date = new Date("2026-10-08T12:00:00Z");
  assert.equal(getWeekLabel(date), "10/5〜10/11");
});
