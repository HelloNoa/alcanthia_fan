import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { gardenGridLayout } = await import("../js/garden.js");

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

console.log("garden layout tests passed");
