import { test } from "node:test";
import assert from "node:assert/strict";
import { getJstDayOfYear } from "./dateUtils";

// JST(UTC+9)で2026-10-14 00:00:00 ちょうど = UTCでは2026-10-13 15:00:00。
// この前後で日付(年初からの日数)が切り替わることを確認する。
test("getJstDayOfYear: JST深夜0時の直前と直後で日数が1増える(UTC 14:59→15:00)", () => {
  const beforeJstMidnight = new Date("2026-10-13T14:59:59.999Z"); // JST 23:59:59.999
  const afterJstMidnight = new Date("2026-10-13T15:00:00.000Z"); // JST 00:00:00.000 (10/14)
  const before = getJstDayOfYear(beforeJstMidnight);
  const after = getJstDayOfYear(afterJstMidnight);
  assert.equal(after, before + 1);
});

test("getJstDayOfYear: UTC深夜0時をまたいでも、JSTの日付が変わっていなければ同じ値を返す", () => {
  // UTC 2026-10-13T23:00(=JST 10/14 08:00)とUTC 2026-10-14T01:00(=JST 10/14 10:00)は
  // どちらもJSTでは同じ10/14なので、同じ値になるべき(=UTC日付境界の影響を受けない)。
  const a = new Date("2026-10-13T23:00:00.000Z");
  const b = new Date("2026-10-14T01:00:00.000Z");
  assert.equal(getJstDayOfYear(a), getJstDayOfYear(b));
});

test("getJstDayOfYear: 年初(JST 1/1 0時)は0を返す", () => {
  const jstNewYear = new Date("2025-12-31T15:00:00.000Z"); // JST 2026-01-01 00:00:00
  assert.equal(getJstDayOfYear(jstNewYear), 0);
});
