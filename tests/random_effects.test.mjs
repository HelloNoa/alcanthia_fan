import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
};

const { randomDistribution } = await import("../js/random_effects.js");
const gameData = JSON.parse(readFileSync(new URL("../data/gamedata.json", import.meta.url), "utf8"));

const closeTo = (actual, expected, epsilon = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
};

const probabilityOf = (distribution, code) =>
  distribution.rows.find((row) => row.code === code)?.prob;

const comet0 = randomDistribution(gameData, "comet_potion", 0);
assert.equal(comet0.rows.length, 16);
closeTo(comet0.maxExpectedValue, 800);
closeTo(comet0.expected, 800, 0.0001);
closeTo(comet0.exponent, -0.4176848232746124);
closeTo(probabilityOf(comet0, "herb_seed"), 0.19792902119075478);
closeTo(probabilityOf(comet0, "black_thorn_sapling"), 0.008274072968814177);

const comet1 = randomDistribution(gameData, "comet_potion", 1);
closeTo(comet1.maxExpectedValue, 2400);
closeTo(comet1.expected, 2400, 0.0002);
closeTo(comet1.exponent, -0.16177216534269975);
closeTo(probabilityOf(comet1, "black_thorn_sapling"), 0.03269625567425777);

const comet2 = randomDistribution(gameData, "comet_potion", 2);
closeTo(comet2.maxExpectedValue, 7200);
closeTo(comet2.expected, 7200, 0.0002);
closeTo(comet2.exponent, 0.34397278735414155);
closeTo(probabilityOf(comet2, "black_thorn_sapling"), 0.14635088923269057);

// +3부터는 기대가치 상한에 닿지 않아 원래 가중치 지수를 그대로 사용한다.
const comet3 = randomDistribution(gameData, "comet_potion", 3);
closeTo(comet3.exponent, 1.05);
closeTo(comet3.expected, 11163.51398647283, 0.0001);
closeTo(probabilityOf(comet3, "black_thorn_sapling"), 0.3280352422429027);

console.log("random effect distribution tests passed");
