import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null };
const { fmtDuration } = await import("../js/sprites.js");

assert.equal(fmtDuration(0), "0초");
assert.equal(fmtDuration(Number.NaN), "-");
assert.equal(fmtDuration(90000), "1분 30초");
assert.equal(fmtDuration(90061000), "1일 1시간 1분 1초");
assert.equal(fmtDuration(31536000000), "1년");
assert.equal(fmtDuration(4473924 * 3600000 + 16 * 60000), "510년 263일 12시간 16분");

console.log("duration formatting tests passed");
