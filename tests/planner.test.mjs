import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const {
  farmersBatonCovers,
  farmersBatonRange,
  plannerEmitterRange,
  plannerCanStackCauldron,
  plannerDeduplicateSharedFences,
  plannerFitGrid,
  plannerGridFromGardenProfile,
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
  plannerToggleSharedFence,
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

const sharedFenceGrid = [
  [{ p: null }, { p: null }],
  [{ p: null }, { p: null }],
];
assert.equal(plannerToggleSharedFence(sharedFenceGrid, 0, 0, "r", {
  code: "rustic_fence",
  enhancement: 2,
}), true);
assert.deepEqual(sharedFenceGrid[0][0].fences.r, {
  code: "rustic_fence",
  enhancement: 2,
});
assert.equal(sharedFenceGrid[0][1].fences, undefined);
assert.equal(plannerToggleSharedFence(sharedFenceGrid, 0, 1, "l", {
  code: "rustic_fence",
  enhancement: 2,
}), false);
assert.equal(sharedFenceGrid[0][0].fences, undefined);
assert.equal(sharedFenceGrid[0][1].fences, undefined);

plannerToggleSharedFence(sharedFenceGrid, 0, 0, "b", {
  code: "rustic_fence",
  enhancement: 1,
});
assert.equal(plannerToggleSharedFence(sharedFenceGrid, 1, 0, "t", {
  code: "flower_trellis_arch",
  enhancement: 5,
}), true);
assert.equal(sharedFenceGrid[0][0].fences, undefined);
assert.deepEqual(sharedFenceGrid[1][0].fences.t, {
  code: "flower_trellis_arch",
  enhancement: 5,
});

const duplicateFenceGrid = [
  [
    {
      p: null,
      fences: {
        t: { code: "flower_trellis_arch", enhancement: 3 },
        r: { code: "rustic_fence", enhancement: 1 },
        b: { code: "root_barrier", enhancement: 2 },
      },
    },
    { p: null, fences: { l: { code: "rustic_fence", enhancement: 5 } } },
  ],
  [
    { p: null, fences: { t: { code: "root_barrier", enhancement: 7 } } },
    { p: null },
  ],
];
assert.deepEqual(plannerDeduplicateSharedFences(duplicateFenceGrid), {
  count: 3,
  removed: 2,
});
assert.deepEqual(duplicateFenceGrid[0][0].fences, {
  t: { code: "flower_trellis_arch", enhancement: 3 },
  r: { code: "rustic_fence", enhancement: 1 },
  b: { code: "root_barrier", enhancement: 2 },
});
assert.equal(duplicateFenceGrid[0][1].fences, undefined);
assert.equal(duplicateFenceGrid[1][0].fences, undefined);

const importedDuplicateBoundary = plannerGridFromGardenProfile({
  grid: [[
    {
      cultivated: true,
      edges: { lowerRight: { itemKey: "flower_trellis_arch+2" } },
    },
    {
      cultivated: true,
      edges: { upperLeft: { itemKey: "flower_trellis_arch+2" } },
    },
  ]],
}, { canvas: 2 });
assert.equal(importedDuplicateBoundary.stats.fences, 1);
assert.deepEqual(importedDuplicateBoundary.grid[0][0].fences, {
  r: { code: "flower_trellis_arch", enhancement: 2 },
});
assert.equal(importedDuplicateBoundary.grid[0][1].fences, undefined);

const importedGarden = plannerGridFromGardenProfile({
  defaultPlantSkins: { herb: "herb_starlit" },
  grid: [
    [
      { cultivated: true, plant: { id: "unknown_plant", enhancement: 2 } },
      {
        cultivated: true,
        plant: { id: "herb", enhancement: 14 },
        surface: { itemKey: "water_channel+2" },
        edges: {
          upperRight: { itemKey: "root_barrier+2" },
          lowerRight: { itemKey: "rustic_fence+1" },
          upperLeft: {
            itemKey: "flower_trellis_arch+5",
            variantId: "flower_trellis_arch:iron",
          },
        },
      },
    ],
    [
      null,
      null,
      {
        cultivated: true,
        ornament: {
          items: [
            { itemKey: "pedestal+2", variantId: "pedestal:marble" },
            { itemKey: "earth_breath+3~t" },
          ],
        },
        surface: { itemKey: "stone_floor+0", variantId: "stone_floor:wooden_deck" },
      },
    ],
    [
      {
        cultivated: false,
        ornament: {
          items: [
            { itemKey: "campfire+4" },
            { itemKey: "copper_cauldron+7" },
          ],
        },
        edges: {
          lowerLeft: { itemKey: "rustic_fence+3" },
          upperLeft: { itemKey: "root_barrier+4" },
        },
      },
    ],
  ],
}, {
  canvas: 7,
  plantData: { herb: {} },
  skinSprites: { herb_starlit: "herb_starlit" },
  itemVariants: {
    "pedestal:marble": { itemCode: "pedestal" },
    "stone_floor:wooden_deck": { itemCode: "stone_floor" },
    "flower_trellis_arch:iron": { itemCode: "flower_trellis_arch" },
  },
});

assert.deepEqual(importedGarden.stats, {
  tiles: 4,
  plants: 1,
  ornaments: 2,
  floors: 2,
  fences: 5,
  displays: 1,
  cauldrons: 1,
});
assert.deepEqual(importedGarden.skipped, [
  { kind: "plant", code: "unknown_plant", count: 1 },
]);
assert.deepEqual(importedGarden.grid[2][3], {
  p: "herb",
  e: 12,
  skinId: "herb_starlit",
  floor: "water_channel",
  fences: {
    t: { code: "root_barrier", enhancement: 2 },
    r: { code: "rustic_fence", enhancement: 1 },
    l: {
      code: "flower_trellis_arch",
      enhancement: 5,
      variantId: "flower_trellis_arch:iron",
    },
  },
});
assert.deepEqual(importedGarden.grid[3][4], {
  orn: "pedestal",
  e: 2,
  variantId: "pedestal:marble",
  display: "earth_breath",
  floor: "stone_floor",
  floorVariantId: "stone_floor:wooden_deck",
});
assert.deepEqual(importedGarden.grid[4][2], {
  orn: "campfire",
  e: 4,
  cauldron: { code: "copper_cauldron", enhancement: 7 },
  fences: {
    b: { code: "rustic_fence", enhancement: 3 },
    l: { code: "root_barrier", enhancement: 4 },
  },
});
assert.throws(
  () => plannerGridFromGardenProfile({ grid: [[{}, {}, {}]] }, { canvas: 2 }),
  /배치판 2×2를 초과/,
);

const trimmedGarden = plannerGridFromGardenProfile({
  grid: [
    [{ cultivated: false }, { cultivated: false }, { cultivated: false }, { cultivated: false }],
    [{ cultivated: false }, { cultivated: true }, { cultivated: true }, { cultivated: false }],
    [{ cultivated: false }, { cultivated: false }, { cultivated: false }, { cultivated: false }],
  ],
}, { canvas: 2 });
assert.equal(trimmedGarden.width, 2);
assert.equal(trimmedGarden.height, 1);
assert.equal(trimmedGarden.stats.tiles, 2);

const largeGarden = Array.from({ length: 29 }, () => Array(29).fill(null));
largeGarden[0][14] = { cultivated: true };
largeGarden[14][0] = { cultivated: true };
largeGarden[14][28] = { cultivated: true };
largeGarden[28][14] = { cultivated: true };
const importedLargeGarden = plannerGridFromGardenProfile({ grid: largeGarden }, { canvas: 33 });
assert.equal(importedLargeGarden.width, 29);
assert.equal(importedLargeGarden.height, 29);
assert.equal(importedLargeGarden.stats.tiles, 4);
assert.deepEqual(importedLargeGarden.grid[2][16], { p: null });
assert.deepEqual(importedLargeGarden.grid[30][16], { p: null });

const oldPlannerGrid = Array.from({ length: 27 }, () => Array(27).fill(null));
oldPlannerGrid[13][13] = { p: "herb", e: 5 };
const migratedPlannerGrid = plannerFitGrid(oldPlannerGrid, 33);
assert.deepEqual(migratedPlannerGrid[16][16], { p: "herb", e: 5 });
assert.equal(migratedPlannerGrid.length, 33);
assert.equal(migratedPlannerGrid.every((row) => row.length === 33), true);

console.log("planner tests passed");
