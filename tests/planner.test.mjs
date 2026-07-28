import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const {
  farmersBatonCovers,
  farmersBatonRange,
  plannerOrnamentEnhancementMax,
  plannerOrnamentSupportsEnhancement,
} = await import("../js/planner.js");

assert.equal(farmersBatonRange(0), 1);
assert.equal(farmersBatonRange(1), 2);
assert.equal(farmersBatonRange(5), 6);
assert.equal(farmersBatonRange(-3), 1);

assert.equal(farmersBatonCovers(10, 10, 10, 10, 0), false);
assert.equal(farmersBatonCovers(10, 10, 10, 11, 0), true);
assert.equal(farmersBatonCovers(10, 10, 11, 11, 0), false);
assert.equal(farmersBatonCovers(10, 10, 11, 11, 1), true);
assert.equal(farmersBatonCovers(10, 10, 10, 13, 1), false);

assert.equal(plannerOrnamentSupportsEnhancement("farmers_baton"), true);
assert.equal(plannerOrnamentSupportsEnhancement("warding_stone"), true);
assert.equal(plannerOrnamentSupportsEnhancement("campfire"), true);
assert.equal(plannerOrnamentSupportsEnhancement("rustic_fence"), true);
assert.equal(plannerOrnamentSupportsEnhancement("unknown_ornament"), false);
assert.equal(plannerOrnamentEnhancementMax("warding_stone"), 40);
assert.equal(plannerOrnamentEnhancementMax("campfire"), 40);
assert.equal(plannerOrnamentEnhancementMax("unknown_ornament"), 0);

console.log("planner ornament enhancement tests passed");
