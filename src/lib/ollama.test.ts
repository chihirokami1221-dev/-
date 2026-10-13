import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { isAiDisabled } from "./ollama";

let saved: string | undefined;

before(() => {
  saved = process.env.AI_FEATURES_DISABLED;
});
after(() => {
  if (saved === undefined) delete process.env.AI_FEATURES_DISABLED;
  else process.env.AI_FEATURES_DISABLED = saved;
});

test("isAiDisabled: 未設定ならfalse(ローカル版は常に有効)", () => {
  delete process.env.AI_FEATURES_DISABLED;
  assert.equal(isAiDisabled(), false);
});

test('isAiDisabled: "true"のときだけtrue', () => {
  process.env.AI_FEATURES_DISABLED = "true";
  assert.equal(isAiDisabled(), true);
});

test('isAiDisabled: "false"や想定外の値はfalse扱い(安全側ではなく有効側だが、仕様通り)', () => {
  process.env.AI_FEATURES_DISABLED = "false";
  assert.equal(isAiDisabled(), false);
  process.env.AI_FEATURES_DISABLED = "1";
  assert.equal(isAiDisabled(), false);
});
