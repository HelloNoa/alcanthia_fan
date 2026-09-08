import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const {
  PLANNER_PRESET_MAX_STAGE,
  farmersBatonCovers,
  farmersBatonRange,
  plannerEmitterRange,
  plannerConditionMap,
  plannerCanStackCauldron,
  plannerCompressShareCode,
  plannerDecompressShareCode,
  plannerDiscordShareText,
  plannerDeduplicateSharedFences,
  plannerEchoHarvestMultiplier,
  plannerEchoHarvestThreshold,
  plannerEchoProductionMultiplier,
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
  plannerPresetRadius,
  plannerRevivalChance,
  plannerRipenedCycleMs,
  plannerShareCodeFromLocation,
  plannerShareSearch,
  plannerStackedCauldronData,
  plannerSunsetRipenDurationMs,
  plannerToggleSharedFence,
} = await import("../js/planner.js");

assert.equal(PLANNER_PRESET_MAX_STAGE, 20);
assert.equal(plannerPresetRadius(0), 0);
assert.equal(plannerPresetRadius(1), 4);
assert.equal(plannerPresetRadius(10), 13);
assert.equal(plannerPresetRadius(20), 23);

assert.equal(plannerShareSearch("abc_123-xyz"), "?plan=abc_123-xyz");
assert.equal(
  plannerDiscordShareText("https://example.com/planner/?plan=code"),
  "[알칸시아 배치 보기](https://example.com/planner/?plan=code)",
);
assert.equal(plannerShareCodeFromLocation({ search: "?plan=abc_123-xyz", hash: "" }), "abc_123-xyz");
assert.equal(plannerShareCodeFromLocation({
  search: "",
  hash: "#p/abc_123-xyz",
}), "abc_123-xyz");
assert.equal(plannerShareCodeFromLocation({
  search: "",
  hash: "#planner/plan/legacy_hash_code",
}), "legacy_hash_code");
assert.equal(plannerShareCodeFromLocation({
  search: "?skins=53&plan=legacy_code",
  hash: "#planner",
}), "legacy_code");
assert.equal(plannerShareCodeFromLocation({
  search: "?skins=53",
  hash: "#planner",
}), "");
assert.equal(plannerShareCodeFromLocation({
  search: "",
  hash: `#planner/plan/${encodeURIComponent("gzu.공유")}`,
}), "gzu.공유");
const shareBytes = new Uint8Array(4096);
for (let index = 0; index < shareBytes.length; index += 64) shareBytes[index] = index % 251;
const rawShareCode = Buffer.from(shareBytes).toString("base64url");
const compressedShareCode = await plannerCompressShareCode(rawShareCode);
assert.match(compressedShareCode, /^z\./);
assert.match(compressedShareCode, /^[\x21-\x7e]+$/);
assert.doesNotMatch(compressedShareCode, /["#%()<>\\`]/);
assert.ok(compressedShareCode.length < rawShareCode.length);
assert.equal(await plannerDecompressShareCode(compressedShareCode), rawShareCode);
assert.equal(await plannerDecompressShareCode(rawShareCode), rawShareCode);
assert.equal(await plannerDecompressShareCode("z.invalid"), "");
assert.equal(await plannerDecompressShareCode("gz.invalid"), "");

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

// Root barriers block ground effects from either stored side of a shared edge.
const effectGrid = () => Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => ({ p: null })));
for (const [side, opposite, dr, dc] of [["t", "b", -1, 0], ["r", "l", 0, 1], ["b", "t", 1, 0], ["l", "r", 0, -1]]) {
  for (const targetSide of [false, true]) {
    for (const fence of ["root_barrier", { code: "root_barrier", enhancement: 4, variantId: "root_barrier:swamp_thicket" }]) {
      const grid = effectGrid();
      grid[2][2] = { p: "poison_flower" };
      const target = grid[2 + dr][2 + dc];
      target.p = "herb";
      assert.equal(plannerConditionMap(grid)[2 + dr][2 + dc].has("poisonous"), true);
      (targetSide ? target : grid[2][2]).fences = { [targetSide ? opposite : side]: fence };
      assert.equal(plannerConditionMap(grid)[2 + dr][2 + dc].has("poisonous"), false, `${side}, targetSide=${targetSide}`);
    }
  }
}

for (const code of ["rustic_fence", "flower_trellis_arch"]) {
  const grid = [[{ p: "poison_flower", fences: { r: { code } } }, { p: "herb" }]];
  assert.equal(plannerConditionMap(grid)[0][1].has("poisonous"), true, code);
}

// Expanded range follows either one-bend (L-shaped) path, not an arbitrary detour.
const expandedEffects = effectGrid();
expandedEffects[2][2] = { p: "poison_flower", e: 4, fences: { r: "root_barrier" } };
const enhancedEffects = (grid) => plannerConditionMap(grid, { vein: true });
assert.equal(enhancedEffects(expandedEffects)[2][4].has("poisonous"), false, "straight path blocked");
assert.equal(enhancedEffects(expandedEffects)[3][3].has("poisonous"), true, "second L-shaped path remains open");
expandedEffects[2][2].fences.b = "root_barrier";
assert.equal(enhancedEffects(expandedEffects)[3][3].has("poisonous"), false, "both L-shaped paths blocked");
delete expandedEffects[2][2].fences;
expandedEffects[2][3].fences = { r: "root_barrier" };
expandedEffects[3][2].fences = { b: "root_barrier" };
assert.equal(enhancedEffects(expandedEffects)[4][4].has("poisonous"), false, "zigzag path does not bypass blocked L-shaped paths");
expandedEffects[2][3].fences = {};
assert.equal(enhancedEffects(expandedEffects)[4][4].has("poisonous"), true, "barrier removal recalculates immediately");
expandedEffects[2][3] = null;
assert.equal(enhancedEffects(expandedEffects)[4][4].has("poisonous"), false, "uncultivated gap also blocks a ground path");
expandedEffects[4][3] = { p: "poison_flower" };
assert.equal(enhancedEffects(expandedEffects)[4][4].has("poisonous"), true, "another unblocked emitter still poisons the target");
assert.equal(enhancedEffects([[{ p: "poison_flower" }]])[0][0].has("poisonous"), false);
assert.deepEqual(plannerConditionMap([]), []);

// Humidity and sunlight use the same barrier rule; anti-magic does not.
for (const [id, condition] of [["dew_root", "humid"], ["sunlight_flower", "sunlit"], ["crystal_fountain", "humid"], ["fairy_lantern", "sunlit"], ["witch_scarecrow", "anti_magic"]]) {
  const source = { [id.endsWith("flower") || id === "dew_root" ? "p" : "orn"]: id, fences: { r: "root_barrier" } };
  assert.equal(plannerConditionMap([[source, { p: "herb" }]])[0][1].has(condition), id === "witch_scarecrow", id);
}
const localEffects = [[
  { p: "poison_flower", fences: { r: "root_barrier" } },
  { p: "herb", cond: ["toxic", "poisonous"], plantCond: ["poisoned"], floor: "water_channel" },
  { p: "herb", floor: "lava_channel" },
]];
const localEffectsBefore = structuredClone(localEffects);
const localConditions = plannerConditionMap(localEffects, { zone: "misty_swamp" });
assert.deepEqual([...localConditions[0][1]].sort(), ["humid", "poisonous", "toxic"]);
assert.deepEqual([...localConditions[0][2]], ["arid"]);
assert.deepEqual(localEffects, localEffectsBefore, "barriers do not erase saved conditions or mutate the layout");

assert.equal(plannerInheritanceChance(0, 5), 0);
assert.equal(plannerInheritanceChance(5, 0), 0);
assert.ok(Math.abs(plannerInheritanceChance(1, 5) - 0.15) < 1e-12);
assert.ok(Math.abs(plannerInheritanceChance(5, 5) - (1 - Math.pow(0.85, 5))) < 1e-12);
assert.equal(plannerRevivalChance(0), 0);
assert.equal(plannerRevivalChance(1), 0.05);
assert.ok(Math.abs(plannerRevivalChance(3) - 0.15) < 1e-12);

assert.equal(plannerEchoHarvestThreshold(0), Number.POSITIVE_INFINITY);
assert.equal(plannerEchoHarvestThreshold(0.5), 10);
assert.equal(plannerEchoHarvestThreshold(1), 5);
assert.equal(plannerEchoHarvestThreshold(1.5), 4);
assert.equal(plannerEchoHarvestThreshold(2), 3);
assert.equal(plannerEchoHarvestThreshold(2.5), 2);
assert.equal(plannerEchoHarvestMultiplier(0, 1), 1);
assert.equal(plannerEchoHarvestMultiplier(1, 1), 1.2);
assert.equal(plannerEchoHarvestMultiplier(2.5, 1), 1.5);
assert.ok(Math.abs(plannerEchoHarvestMultiplier(1, 0.5) - (1 + 1 / 31)) < 1e-12);
assert.ok(Math.abs(plannerEchoProductionMultiplier(1, 0.5, false) - (1 + 1 / 31)) < 1e-12);
assert.equal(plannerEchoProductionMultiplier(1, 0.5, true), 1.2);

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

const expandedPlannerGrid = plannerFitGrid(oldPlannerGrid);
assert.deepEqual(expandedPlannerGrid[23][23], { p: "herb", e: 5 });
assert.equal(expandedPlannerGrid.length, 47);
assert.equal(expandedPlannerGrid.every((row) => row.length === 47), true);

console.log("planner tests passed");
