import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const {
  farmersBatonCovers,
  farmersBatonRange,
  plannerEmitterRange,
  plannerOrnamentEnhancementMax,
  plannerOrnamentSupportsEnhancement,
  plannerPollProductionPerHour,
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

assert.equal(plannerEmitterRange("witch_scarecrow", 10, 0, true), 1);
assert.equal(plannerEmitterRange("crystal_fountain", 10, 0, true), 1);
assert.equal(plannerEmitterRange("fairy_lantern", 10, 0, true), 1);
assert.equal(plannerEmitterRange("sunlight_flower", 5, 0, true), 6);
assert.equal(plannerEmitterRange("poison_flower", 3, 0, false), 1);
assert.equal(plannerEmitterRange("dew_root", 3, 2, true), 6);

assert.equal(plannerPollProductionPerHour({
  pollIntervalMs: 60000,
  growTimeMs: 10000,
  produceIntervalMs: 1,
}), 60);
assert.equal(plannerPollProductionPerHour({
  pollIntervalMs: 60000,
  growTimeMs: 30000,
  produceIntervalMs: 1,
  harvests: 3,
}), 180);
assert.ok(Math.abs(plannerPollProductionPerHour({
  pollIntervalMs: 60000,
  growTimeMs: 45000,
  produceIntervalMs: 3600000,
}) - (60 / 61)) < 1e-12);

console.log("planner tests passed");
