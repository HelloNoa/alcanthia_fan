import assert from "node:assert/strict";
import test from "node:test";

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { plannerPollinationPath, plannerToggleSharedFence } = await import("../js/planner.js");

for (const [side, opposite, dr, dc] of [
  ["t", "b", -1, 0], ["b", "t", 1, 0],
  ["l", "r", 0, -1], ["r", "l", 0, 1],
]) {
  for (const edge of [0, 1]) for (const targetSide of [false, true]) {
    test(`pollination ${side}: edge ${edge}, stored on ${targetSide ? "target" : "source"}`, () => {
      const grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => ({})));
      grid[2][2] = { p: "wind_blossom" };
      grid[2 + dr][2 + dc] = { p: "herb" };
      const path = [[2 + dr, 2 + dc], [2 + dr * 2, 2 + dc * 2]];
      assert.deepEqual(plannerPollinationPath(grid, 2, 2, dr, dc), path);
      const offset = edge + Number(targetSide);
      const row = 2 + dr * offset, col = 2 + dc * offset;
      const fenceSide = targetSide ? opposite : side;
      for (const code of ["rustic_fence", "root_barrier", "flower_trellis_arch"]) {
        for (const fence of [code, { code, enhancement: 5, variantId: `${code}:test` }]) {
          grid[row][col].fences = { [fenceSide]: fence };
          assert.deepEqual(plannerPollinationPath(grid, 2, 2, dr, dc),
            code === "flower_trellis_arch" ? path : path.slice(0, edge));
        }
        // Removing the same boundary restores the clone and production candidate path.
        plannerToggleSharedFence(grid, row, col, fenceSide, { code, enhancement: 5, variantId: `${code}:test` });
        assert.deepEqual(plannerPollinationPath(grid, 2, 2, dr, dc), path);
      }
    });
  }
}

test("pollination stops at unplanted land boundaries and the grid edge", () => {
  assert.deepEqual(plannerPollinationPath([[{ p: "wind_blossom" }, null, {}]], 0, 0, 0, 1), []);
  assert.deepEqual(plannerPollinationPath([[{ p: "wind_blossom" }, { p: "herb" }]], 0, 0, 0, 1), [[0, 1]]);
});
