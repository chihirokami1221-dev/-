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

// 実行環境のタイムゾーン(ローカル=JST、Vercel等の本番=通常UTC)に関わらず、
// クライアント(ブラウザ=JST)とサーバーが同じ「週の開始」を指すことを保証するため、
// getStartOfWeekが常にJST基準の月曜0時(を表す絶対時刻)を返すことを、
// 実行環境のタイムゾーンに依存しない絶対時刻(getTime())で確認する
// (実際に発生した不具合: Weekly ToDoを追加しても、サーバー側のタイムゾーンでの
// 週開始とズレて一致せず、表示上消えてしまっていた)。
test("getStartOfWeek: 実行環境のタイムゾーンに依存せず、常にJST基準の月曜0時を返す(絶対時刻で検証)", () => {
  // 2026-10-08T12:00:00Z(UTC) = 2026-10-08 21:00 JST(木曜)。
  // そのJSTの週の月曜0時(2026-10-05 00:00 JST) = 2026-10-04T15:00:00.000Z。
  const date = new Date("2026-10-08T12:00:00Z");
  const start = getStartOfWeek(date);
  assert.equal(start.toISOString(), "2026-10-04T15:00:00.000Z");
});

test("getStartOfWeek: UTCでは前日(日曜)になる時刻でも、JST基準で正しい週を返す", () => {
  // 2026-10-04T16:00:00Z(UTC、日曜) = 2026-10-05 01:00 JST(月曜)。
  // UTC基準で計算すると前週(9/28)になってしまうが、JST基準では当週(10/5)が正しい。
  const date = new Date("2026-10-04T16:00:00Z");
  const start = getStartOfWeek(date);
  assert.equal(start.toISOString(), "2026-10-04T15:00:00.000Z");
});
