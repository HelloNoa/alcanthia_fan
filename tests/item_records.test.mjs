import assert from "node:assert/strict";
import { normalizeHighestItemRecords } from "../js/item_records.js";

const records = normalizeHighestItemRecords([
  { itemCode: "copper_cauldron", enhancement: 8, nickname: "낮은기록" },
  { itemCode: "copper_cauldron", enhancement: 10, nickname: " 최고기록 " },
  { itemCode: "healing_potion", enhancement: "7", nickname: "포션장인" },
  { itemCode: "healing_potion", enhancement: 6, nickname: "이전기록" },
  { itemCode: "", enhancement: 99, nickname: "무효" },
  { itemCode: "broken", enhancement: "not-a-number", nickname: "무효" },
]);

assert.deepEqual(records.get("copper_cauldron"), {
  itemCode: "copper_cauldron",
  enhancement: 10,
  nickname: "최고기록",
});
assert.deepEqual(records.get("healing_potion"), {
  itemCode: "healing_potion",
  enhancement: 7,
  nickname: "포션장인",
});
assert.equal(records.has("broken"), false);

console.log("item record tests passed");
