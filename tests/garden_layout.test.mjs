import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const {
  gardenAchievementModifier,
  gardenCumulativeGold,
  gardenEdgeItems,
  gardenGridLayout,
  gardenPopularity,
  gardenProfileIntro,
  gardenSnapshotLimitedProduce,
  gardenSurfaceItem,
} = await import("../js/garden.js");

assert.equal(gardenAchievementModifier({ achievementModifier: "  주점단골  " }), "주점단골");
assert.equal(gardenAchievementModifier({ achievement_modifier: "좋은 이웃" }), "좋은 이웃");
assert.equal(gardenAchievementModifier({ achievementModifier: "   " }), "");
assert.equal(gardenAchievementModifier({}), "");

assert.equal(gardenProfileIntro({ profileIntro: "  안녕하세요\n반갑습니다  " }), "안녕하세요\n반갑습니다");
assert.equal(gardenProfileIntro({ profileIntro: "   " }), "");
assert.equal(gardenProfileIntro({ profileIntro: null }), "");
assert.equal(gardenProfileIntro(null), "");

assert.equal(gardenCumulativeGold({ leaderboardGoldEarned: 1_028_325_955 }), 1_028_325_955);
assert.equal(
  gardenCumulativeGold({ leaderboardGoldEarned: 0, totalGoldEarned: 999 }),
  0,
);
assert.equal(gardenCumulativeGold({ totalGoldEarned: "12345" }), 12_345);
assert.equal(gardenCumulativeGold({ leaderboardGoldEarned: "unknown" }), null);
assert.equal(gardenCumulativeGold({}), null);

assert.equal(gardenPopularity({ popularity: -32 }), -32);
assert.equal(gardenPopularity({ popularity: 0 }), 0);
assert.equal(gardenPopularity({ popularity: "200" }), 200);
assert.equal(gardenPopularity({ popularity: "unknown" }), null);
assert.equal(gardenPopularity({}), null);

assert.deepEqual(gardenSnapshotLimitedProduce(null), []);
assert.deepEqual(
  gardenSnapshotLimitedProduce({
    production: [
      { itemKey: "herb+5", perHour: 214 },
      { itemKey: "red_flower_leaf+5", perHour: 1_200 },
      { itemKey: "moonlight_mushroom+5", perHour: 48 },
      { itemKey: "herb+5", perHour: 200 },
      { itemKey: "nightshade_root", perHour: 1 },
    ],
  }),
  ["herb", "moonlight_mushroom", "nightshade_root"],
);

const square21 = Array.from({ length: 21 }, () => Array(21).fill(null));
assert.deepEqual(gardenGridLayout(square21, 500), { rows: 21, cols: 21, cellSize: 32 });
assert.deepEqual(gardenGridLayout(square21, 960), { rows: 21, cols: 21, cellSize: 43 });
assert.deepEqual(gardenGridLayout(square21, 500, "fit"), { rows: 21, cols: 21, cellSize: 21 });

const ragged = [[], Array(27).fill(null), Array(13).fill(null)];
assert.deepEqual(gardenGridLayout(ragged, 500), { rows: 12, cols: 27, cellSize: 32 });
assert.deepEqual(gardenGridLayout(ragged, 1000), { rows: 12, cols: 27, cellSize: 34 });
assert.deepEqual(gardenGridLayout(ragged, 500, "fit"), { rows: 12, cols: 27, cellSize: 16 });
assert.deepEqual(gardenGridLayout(ragged, 300, "fit"), { rows: 12, cols: 27, cellSize: 9 });

const standard = Array.from({ length: 12 }, () => Array(12).fill(null));
assert.deepEqual(gardenGridLayout(standard, 960), { rows: 12, cols: 12, cellSize: 44 });
assert.deepEqual(gardenGridLayout(null, 0), { rows: 12, cols: 12, cellSize: 44 });

const sparse = Array(15);
sparse[14] = Array(20).fill(null);
assert.deepEqual(gardenGridLayout(sparse, 960), { rows: 15, cols: 20, cellSize: 44 });

assert.equal(gardenSurfaceItem(null), null);
assert.equal(gardenSurfaceItem({ surface: null }), null);
assert.deepEqual(
  gardenSurfaceItem({ surface: { itemKey: "water_channel+2" } }),
  { code: "water_channel", enhancement: 2 },
);
assert.deepEqual(
  gardenSurfaceItem({ surface: { itemKey: "lava_channel+0~t" } }),
  { code: "lava_channel", enhancement: 0 },
);
assert.deepEqual(gardenEdgeItems(null), []);
assert.deepEqual(
  gardenEdgeItems({
    edges: {
      upperLeft: { itemKey: "rustic_fence+1" },
      upperRight: "root_barrier+2",
      lowerLeft: null,
      lowerRight: { itemKey: "rustic_fence+0" },
    },
  }),
  [
    {
      edge: "upperRight",
      side: "t",
      label: "위",
      code: "root_barrier",
      enhancement: 2,
    },
    {
      edge: "lowerRight",
      side: "r",
      label: "오른쪽",
      code: "rustic_fence",
      enhancement: 0,
    },
    {
      edge: "upperLeft",
      side: "l",
      label: "왼쪽",
      code: "rustic_fence",
      enhancement: 1,
    },
  ],
);

console.log("garden layout tests passed");
