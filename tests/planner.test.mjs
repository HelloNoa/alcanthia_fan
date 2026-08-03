import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const {
  farmersBatonCovers,
  farmersBatonRange,
  plannerEmitterRange,
  plannerCanStackCauldron,
  plannerItemVariantId,
  plannerItemVariantIds,
  plannerInheritanceChance,
  plannerOrnamentEnhancementMax,
  plannerOrnamentSupportsEnhancement,
  plannerPlantSkinId,
  plannerPlantSkinIds,
  plannerPollProductionPerHour,
  plannerRevivalChance,
  plannerRipenedCycleMs,
  plannerStackedCauldronData,
  plannerSunsetRipenDurationMs,
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
assert.equal(plannerOrnamentSupportsEnhancement("levitation_chest"), true);
assert.equal(plannerOrnamentSupportsEnhancement("compost_bin"), true);
assert.equal(plannerOrnamentSupportsEnhancement("rustic_fence"), true);
assert.equal(plannerOrnamentSupportsEnhancement("unknown_ornament"), false);
assert.equal(plannerOrnamentEnhancementMax("warding_stone"), 40);
assert.equal(plannerOrnamentEnhancementMax("campfire"), 40);
assert.equal(plannerOrnamentEnhancementMax("unknown_ornament"), 0);

assert.equal(plannerCanStackCauldron({ orn: "campfire" }, "copper_cauldron"), true);
assert.equal(plannerCanStackCauldron({ orn: "storage_chest" }, "copper_cauldron"), false);
assert.equal(plannerCanStackCauldron({ orn: "campfire" }, "cauldron_controller"), false);
assert.deepEqual(plannerStackedCauldronData({ code: "gold_cauldron", enhancement: 12 }), {
  code: "gold_cauldron",
  enhancement: 12,
});
assert.deepEqual(plannerStackedCauldronData({ itemCode: "rune_cauldron", e: 99 }), {
  code: "rune_cauldron",
  enhancement: 40,
});
assert.equal(plannerStackedCauldronData({ code: "cauldron_controller", enhancement: 3 }), null);

assert.equal(plannerEmitterRange("witch_scarecrow", 10, 0, true), 1);
assert.equal(plannerEmitterRange("crystal_fountain", 10, 0, true), 1);
assert.equal(plannerEmitterRange("fairy_lantern", 10, 0, true), 1);
assert.equal(plannerEmitterRange("sunlight_flower", 5, 0, true), 6);
assert.equal(plannerEmitterRange("poison_flower", 3, 0, false), 1);
assert.equal(plannerEmitterRange("dew_root", 3, 2, true), 6);

assert.equal(plannerInheritanceChance(0, 5), 0);
assert.equal(plannerInheritanceChance(5, 0), 0);
assert.ok(Math.abs(plannerInheritanceChance(1, 5) - 0.15) < 1e-12);
assert.ok(Math.abs(plannerInheritanceChance(5, 5) - (1 - Math.pow(0.85, 5))) < 1e-12);
assert.equal(plannerRevivalChance(0), 0);
assert.equal(plannerRevivalChance(1), 0.05);
assert.ok(Math.abs(plannerRevivalChance(3) - 0.15) < 1e-12);

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
assert.equal(plannerPollProductionPerHour({
  pollIntervalMs: 60000,
  growTimeMs: 10000,
  produceIntervalMs: 1,
  cycleMs: 120001,
}), 20);
assert.ok(Math.abs(plannerPollProductionPerHour({
  pollIntervalMs: 60000,
  growTimeMs: 10000,
  produceIntervalMs: 0,
  revivalChance: 0.15,
}) - 70.58743125) < 1e-9);
assert.ok(Math.abs(plannerPollProductionPerHour({
  pollIntervalMs: 60000,
  growTimeMs: 3600000,
  produceIntervalMs: 0,
  revivalChance: 0.15,
}) - 1) < 1e-12);

assert.equal(plannerSunsetRipenDurationMs({
  oneShot: false,
  growTimeMs: 10000,
  produceIntervalMs: 15000,
  zoneCoeff: 2,
}), 25000);
assert.equal(plannerSunsetRipenDurationMs({
  oneShot: true,
  growTimeMs: 30000,
  produceIntervalMs: 1,
  zoneCoeff: 2,
}), 50000);
assert.equal(plannerSunsetRipenDurationMs({
  oneShot: true,
  growTimeMs: 30000,
  produceIntervalMs: 1,
  zoneCoeff: 0,
}), null);
assert.equal(plannerRipenedCycleMs({
  growTimeMs: 10000,
  produceIntervalMs: 5000,
  harvests: 2,
  capacity: 1,
  ripenTimeMs: 20000,
}), 60000);
assert.equal(plannerRipenedCycleMs({
  growTimeMs: 30000,
  produceIntervalMs: 0,
  harvests: 3,
  capacity: 3,
  ripenTimeMs: 50000,
}), 80000);

const skinSprites = {
  herb_golden_petal: "herb_golden_petal",
  herb_starlit: "herb_starlit",
  red_flower_starlit: "red_flower_starlit",
};
assert.deepEqual(plannerPlantSkinIds("herb", skinSprites), [
  "herb_golden_petal",
  "herb_starlit",
]);
assert.equal(plannerPlantSkinId("herb", "herb_starlit", skinSprites), "herb_starlit");
assert.equal(plannerPlantSkinId("herb", "red_flower_starlit", skinSprites), "");
assert.equal(plannerPlantSkinId("herb", "unknown_skin", skinSprites), "");

const itemVariants = {
  "stone_floor:grass": { itemCode: "stone_floor", name: "잔디", sprite: "grass_floor" },
  "stone_floor:wooden_deck": { itemCode: "stone_floor", name: "나무 데크", sprite: "wooden_deck_floor" },
  "rustic_fence:iron": { itemCode: "rustic_fence", name: "철제 울타리", sprite: "rustic_fence_iron" },
};
assert.deepEqual(plannerItemVariantIds("stone_floor", itemVariants), [
  "stone_floor:grass",
  "stone_floor:wooden_deck",
]);
assert.equal(
  plannerItemVariantId("stone_floor", "stone_floor:wooden_deck", itemVariants),
  "stone_floor:wooden_deck",
);
assert.equal(plannerItemVariantId("stone_floor", "rustic_fence:iron", itemVariants), "");

console.log("planner tests passed");
