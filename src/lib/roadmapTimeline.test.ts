import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAllRange, computeRangeForZoom, startOfMonth, addMonths } from "./roadmapTimeline";

const today = new Date(2026, 9, 20); // 2026-10-20

test("computeAllRange: 項目も無く今日だけの場合、最低半年先(今月+6ヶ月)まで表示する", () => {
  const range = computeAllRange([], today, []);
  assert.deepEqual(range.start, startOfMonth(today));
  assert.deepEqual(range.end, addMonths(startOfMonth(today), 6));
});

test("computeAllRange: 計画ブロック(項目)が無くても、イベントの日付が表示範囲に含まれる", () => {
  // 項目(計画ブロック)は0件(削除済みを想定)だが、3ヶ月先にイベントがある。
  const events = [{ date: new Date(2027, 0, 15) }]; // 2027-01-15(今日から約3ヶ月先)
  const range = computeAllRange([], today, events);
  // イベントの月を含む(月初+1ヶ月)まで広がっているはず。
  assert.ok(range.end.getTime() >= addMonths(startOfMonth(new Date(2027, 0, 15)), 1).getTime());
});

test("computeAllRange: イベントが半年より先の場合、その日付まで表示範囲が広がる(半年は最低保証であり上限ではない)", () => {
  const farEvent = new Date(2027, 11, 1); // 2027-12-01(半年よりかなり先)
  const range = computeAllRange([], today, [{ date: farEvent }]);
  assert.ok(range.end.getTime() >= addMonths(startOfMonth(farEvent), 1).getTime());
});

test("computeAllRange: 項目の日付が今日より過去でも開始日に反映される", () => {
  const items = [{ id: "1", startDate: new Date(2026, 0, 1), dueDate: new Date(2026, 2, 1) }];
  const range = computeAllRange(items, today, []);
  assert.deepEqual(range.start, startOfMonth(new Date(2026, 0, 1)));
});

test("computeRangeForZoom: 'all'はイベントの日付も考慮する", () => {
  const events = [{ date: new Date(2027, 2, 1) }];
  const range = computeRangeForZoom("all", [], today, events);
  assert.ok(range.end.getTime() >= addMonths(startOfMonth(new Date(2027, 2, 1)), 1).getTime());
});

test("computeRangeForZoom: 'all'以外(明示的なズーム)はイベントの有無に関わらず固定幅のまま", () => {
  const events = [{ date: new Date(2030, 0, 1) }]; // 非常に先のイベント
  const range = computeRangeForZoom("3m", [], today, events);
  assert.deepEqual(range.start, startOfMonth(today));
  assert.deepEqual(range.end, addMonths(startOfMonth(today), 3));
});
