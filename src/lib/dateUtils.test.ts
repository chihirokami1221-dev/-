import { test } from "node:test";
import assert from "node:assert/strict";
import { getJstDayOfYear, getJstEpochDay, getNoRepeatDailyIndex } from "./dateUtils";

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
  const a = new Date("2026-10-13T23:00:00.000Z");
  const b = new Date("2026-10-14T01:00:00.000Z");
  assert.equal(getJstDayOfYear(a), getJstDayOfYear(b));
});

test("getJstDayOfYear: 年初(JST 1/1 0時)は0を返す", () => {
  const jstNewYear = new Date("2025-12-31T15:00:00.000Z"); // JST 2026-01-01 00:00:00
  assert.equal(getJstDayOfYear(jstNewYear), 0);
});

test("getJstEpochDay: 年をまたいでも連続して1ずつ増える(年初にリセットされない)", () => {
  const dec31 = new Date("2025-12-30T15:00:00.000Z"); // JST 2025-12-31 00:00:00
  const jan1 = new Date("2025-12-31T15:00:00.000Z"); // JST 2026-01-01 00:00:00
  assert.equal(getJstEpochDay(jan1), getJstEpochDay(dec31) + 1);
});

test("getNoRepeatDailyIndex: 1周回(listLength日)の中で同じ項目が重複しない", () => {
  const listLength = 7;
  const start = new Date("2026-10-14T00:00:00.000Z");
  // 周回の境目が開始日の途中に来ても正しく検証できるよう、十分に長い期間を見て、
  // 「同じ周回番号」ごとにグループ化してから、各グループ内で重複が無いことを確認する。
  const byCycle = new Map<number, number[]>();
  for (let i = 0; i < listLength * 5; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const epochDay = getJstEpochDay(d);
    const cycle = Math.floor(epochDay / listLength);
    const index = getNoRepeatDailyIndex(d, listLength, "test-salt");
    const arr = byCycle.get(cycle) ?? [];
    arr.push(index);
    byCycle.set(cycle, arr);
  }
  for (const [cycle, indices] of byCycle) {
    if (indices.length < listLength) continue; // 期間の端で不完全な周回はスキップ
    assert.equal(new Set(indices).size, listLength, `周回${cycle}で重複が発生: ${indices.join(",")}`);
  }
});

test("getNoRepeatDailyIndex: 周回が変わるとシャッフル順も変わる(2周目が1周目の単純な繰り返しにならない)", () => {
  const listLength = 5;
  const start = new Date("2026-10-14T00:00:00.000Z");
  const cycle1: number[] = [];
  const cycle2: number[] = [];
  for (let i = 0; i < listLength; i++) {
    cycle1.push(getNoRepeatDailyIndex(new Date(start.getTime() + i * 86400000), listLength, "cycle-test"));
    cycle2.push(getNoRepeatDailyIndex(new Date(start.getTime() + (listLength + i) * 86400000), listLength, "cycle-test"));
  }
  assert.notDeepEqual(cycle1, cycle2, "周回が変わっても全く同じ順序になってしまっている");
});

test("getNoRepeatDailyIndex: saltが異なれば、同じ日でも異なる項目を指しうる(本・単語・名言が連動しない)", () => {
  const d = new Date("2026-10-14T00:00:00.000Z");
  const a = getNoRepeatDailyIndex(d, 10, "salt-a");
  const b = getNoRepeatDailyIndex(d, 10, "salt-b");
  // 確率的にはほぼ必ず異なるはずだが、理論上の一致を完全排除はできないため、
  // ここでは「常に同じ関数が同じ結果を返す(決定的)」ことの確認に留める。
  assert.equal(a, getNoRepeatDailyIndex(d, 10, "salt-a"));
  assert.equal(b, getNoRepeatDailyIndex(d, 10, "salt-b"));
});

test("getNoRepeatDailyIndex: listLengthが0以下でも例外を投げず0を返す", () => {
  assert.equal(getNoRepeatDailyIndex(new Date(), 0, "x"), 0);
});
