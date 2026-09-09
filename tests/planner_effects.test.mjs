import assert from "node:assert/strict";
import test from "node:test";

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const {
  plannerConditionMap,
  plannerEffectivePlantEnhancement,
  plannerEmitterRange,
} = await import("../js/planner.js");
const field = (size = 9) => Array.from({ length: size }, () => Array.from({ length: size }, () => ({ p: null })));

test("fountain and lantern range scales with ornament enhancement, without vein reading", () => {
  for (const id of ["crystal_fountain", "fairy_lantern"]) {
    assert.equal(plannerEmitterRange(id, 3), 4);
    assert.equal(plannerEmitterRange(id, 40, 2, true), 41);
  }
  assert.equal(plannerEmitterRange("witch_scarecrow", 40, 2, true), 1);
});

test("poison flower combines vein reading, compost and venom potion independently", () => {
  assert.equal(plannerEmitterRange("poison_flower", 3), 1);
  assert.equal(plannerEmitterRange("poison_flower", 3, 2, false, { venom: true, composted: true }), 2);
  assert.equal(plannerEmitterRange("poison_flower", 3, 0, true), 4);
  assert.equal(plannerEmitterRange("poison_flower", 3, 0, true, { venom: true }), 5);
  assert.equal(plannerEmitterRange("poison_flower", 3, 0, true, { venom: true, composted: true }), 6);
  assert.equal(plannerEmitterRange("poison_flower", 12, 0, true, { venom: true, composted: true }), 15);
});

test("dew root alone gains root dominion and moss jelly; sunlight only gains effective enhancement", () => {
  const buffs = { mossJelly: true, venom: true, composted: true };
  assert.equal(plannerEmitterRange("dew_root", 3, 2, true, buffs), 8);
  assert.equal(plannerEmitterRange("dew_root", 3, 2, false, buffs), 4);
  assert.equal(plannerEmitterRange("sunlight_flower", 3, 2, true, buffs), 5);
  assert.equal(plannerEmitterRange("sunlight_flower", 3, 2, false, buffs), 1);
  assert.equal(plannerEmitterRange("crystal_fountain", 3, 2, true, buffs), 4);
});

test("effective plant enhancement adds compost only once, without changing the seed", () => {
  const cell = { p: "poison_flower", e: 12 };
  assert.equal(plannerEffectivePlantEnhancement(cell, new Set(["composted"])), 13);
  assert.equal(plannerEffectivePlantEnhancement(cell, new Set()), 12);
  assert.equal(plannerEffectivePlantEnhancement({ p: "herb" }, new Set(["composted"])), 1);
  assert.equal(plannerEffectivePlantEnhancement({ orn: "fairy_lantern", e: 3 }, new Set(["composted"])), 3);
  assert.deepEqual(cell, { p: "poison_flower", e: 12 });
});

test("base poison range excludes diagonals; venom expands the Manhattan diamond by one", () => {
  const grid = field();
  grid[4][4] = { p: "poison_flower" };
  const base = plannerConditionMap(grid);
  assert.equal(base[4][5].has("poisonous"), true);
  assert.equal(base[5][5].has("poisonous"), false);
  const buffed = plannerConditionMap(grid, { venom: true });
  assert.equal(buffed[5][5].has("poisonous"), true);
  assert.equal(buffed[4][6].has("poisonous"), true);
  assert.equal(buffed[5][6].has("poisonous"), false);
  assert.equal(buffed[4][4].has("poisonous"), false);
});

test("potion-expanded effects still respect root barriers and uncultivated gaps", () => {
  const grid = field();
  grid[4][4] = { p: "poison_flower", fences: { r: "root_barrier" } };
  assert.equal(plannerConditionMap(grid, { venom: true })[4][6].has("poisonous"), false);
  delete grid[4][4].fences;
  grid[4][5] = null;
  assert.equal(plannerConditionMap(grid, { venom: true })[4][6].has("poisonous"), false);
});

test("moss jelly expands humidity but not sunlight or poison", () => {
  const grid = field();
  grid[4][4] = { p: "dew_root" };
  assert.equal(plannerConditionMap(grid)[4][6].has("humid"), false);
  assert.equal(plannerConditionMap(grid, { mossJelly: true })[4][6].has("humid"), true);
  grid[4][4] = { p: "sunlight_flower" };
  assert.equal(plannerConditionMap(grid, { mossJelly: true })[4][6].has("sunlit"), false);
});

test("compost requires supplied bins and affects only their own tile and adjacent unblocked tiles", () => {
  const grid = field();
  grid[4][4] = { orn: "compost_bin", e: 20 };
  assert.equal(plannerConditionMap(grid)[4][5].has("composted"), false);
  const supplied = plannerConditionMap(grid, { compost: true });
  for (const [r, c] of [[4, 4], [3, 4], [5, 4], [4, 3], [4, 5]]) assert.equal(supplied[r][c].has("composted"), true);
  assert.equal(supplied[5][5].has("composted"), false);
  assert.equal(supplied[4][6].has("composted"), false);
  for (const targetSide of [false, true]) {
    const blocked = structuredClone(grid);
    blocked[4][targetSide ? 5 : 4].fences = { [targetSide ? "l" : "r"]: "root_barrier" };
    assert.equal(plannerConditionMap(blocked, { compost: true })[4][5].has("composted"), false);
  }
});

test("multiple bins do not stack compost; removing a blocking fence restores its range bonus", () => {
  const grid = field(13);
  grid[6][6] = { p: "poison_flower", e: 1 };
  grid[6][5] = { orn: "compost_bin", fences: { r: "root_barrier" } };
  const options = { compost: true, vein: true };
  assert.equal(plannerConditionMap(grid, options)[6][9].has("poisonous"), false);
  delete grid[6][5].fences;
  assert.equal(plannerConditionMap(grid, options)[6][9].has("poisonous"), true);
  grid[5][6] = { orn: "compost_bin", e: 40 };
  const conditions = plannerConditionMap(grid, options);
  assert.equal(conditions[6][9].has("poisonous"), true);
  assert.equal(conditions[6][10].has("poisonous"), false);
  assert.equal(plannerConditionMap(grid, { compost: true })[6][8].has("poisonous"), false, "compost cannot extend plant effects without vein reading");
});

test("non-root fences do not block compost and disabled supply clears the computed bonus", () => {
  const grid = field();
  grid[4][4] = { orn: "compost_bin", fences: { r: "rustic_fence" } };
  assert.equal(plannerConditionMap(grid, { compost: true })[4][5].has("composted"), true);
  assert.equal(plannerConditionMap(grid, { compost: false })[4][5].has("composted"), false);
});

test("sunlight and water ornaments affect their own tile and their enhanced range", () => {
  for (const [id, condition] of [["crystal_fountain", "humid"], ["fairy_lantern", "sunlit"]]) {
    const grid = field();
    grid[4][4] = { orn: id, e: 2 };
    const conditions = plannerConditionMap(grid);
    assert.equal(conditions[4][4].has(condition), true);
    assert.equal(conditions[4][7].has(condition), true);
    assert.equal(conditions[4][8].has(condition), false);
    grid[4][4].fences = { r: "root_barrier" };
    assert.equal(plannerConditionMap(grid)[4][7].has(condition), false);
  }
  const grid = [[{ p: "sunlight_flower" }]];
  assert.equal(plannerConditionMap(grid)[0][0].has("sunlit"), true);
});

test("computed bonuses do not modify saved layout or remove directly applied conditions", () => {
  const grid = [[{ orn: "compost_bin" }, { p: "dew_root", e: 2 }, { p: "herb", cond: ["toxic"], floor: "lava_channel" }]];
  const before = structuredClone(grid);
  const conditions = plannerConditionMap(grid, { compost: true, vein: true, mossJelly: true, venom: true });
  assert.equal(conditions[0][2].has("toxic"), true);
  assert.equal(conditions[0][2].has("arid"), true);
  assert.equal(conditions[0][2].has("humid"), false);
  assert.deepEqual(grid, before);
});
