import assert from "node:assert/strict";
import {
  ENHANCEMENT_EV_STORE,
  loadEnhancementEvState,
  saveEnhancementEvItem,
} from "../js/calc_state.js";

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};

values.set(ENHANCEMENT_EV_STORE, JSON.stringify({ item: "silver_cauldron", wick: 10, target: 12 }));
assert.deepEqual(saveEnhancementEvItem("copper_cauldron", storage), {
  item: "copper_cauldron",
  wick: 10,
  target: 12,
});
assert.deepEqual(loadEnhancementEvState(storage), {
  item: "copper_cauldron",
  wick: 10,
  target: 12,
});

values.set(ENHANCEMENT_EV_STORE, "{broken");
assert.deepEqual(saveEnhancementEvItem("gold_cauldron", storage), { item: "gold_cauldron" });

values.set(ENHANCEMENT_EV_STORE, "[]");
assert.deepEqual(loadEnhancementEvState(storage), {});

console.log("calc state tests passed");
