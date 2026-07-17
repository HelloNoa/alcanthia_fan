import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultEnhancementMaterialPrice } from "../js/calc_prices.js";
import { enhancementMaterialFlow } from "../js/enhancement_ev.js";

const closeTo = (actual, expected, epsilon = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
};
const closeRelative = (actual, expected, epsilon = 1e-11) => {
  const scale = Math.max(Math.abs(actual), Math.abs(expected), 1e-300);
  assert.ok(Math.abs(actual - expected) <= epsilon * scale, `${actual} != ${expected}`);
};
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const gameData = JSON.parse(readFileSync(new URL("../data/gamedata.json", import.meta.url), "utf8"));
const expectedShopBuyPrices = {
  herb_seed: 10,
  red_flower_seed: 30,
  engraving_stone: 1000,
  old_cauldron: 10000,
  dissolution_potion: 2000,
  polishing_powder: 500,
  dia_box_30: 300000,
};
assert.deepEqual(new Set(gameData.shop_items), new Set(Object.keys(expectedShopBuyPrices)));
for (const [code, expected] of Object.entries(expectedShopBuyPrices)) {
  assert.equal(defaultEnhancementMaterialPrice(gameData, code), expected, `${code} shop buy price`);
  if (!code.startsWith("dia_box_")) assert.equal(expected, gameData.sell_price[code] * 2, `${code} buy/sell ratio`);
}
assert.equal(defaultEnhancementMaterialPrice(gameData, "dia_box_30"), gameData.item_values.dia_box_30);
assert.equal(defaultEnhancementMaterialPrice(gameData, "copper_scrap"), gameData.item_values.copper_scrap);

// 목표에서 시작점으로 거꾸로 계산한 장기 산출률. 순방향 재고 배열을 사용하지 않는다.
const backwardTargetYield = ({ start, target, successRate, bonusRate = 0, sourceBonusRate = 0, goal = "exact" }) => {
  const bonus = clamp01(bonusRate), sourceBonus = clamp01(sourceBonusRate);
  const yieldAt = new Map([[target, 1]]);
  const getYield = (level) => level > target ? (goal === "atLeast" ? 1 : 0) : (yieldAt.get(level) || 0);
  for (let level = target - 1; level >= start; level--) {
    const p = clamp01(successRate(level));
    yieldAt.set(level, p / (1 + p) * ((1 - bonus) * getYield(level + 1) + bonus * getYield(level + 2)));
  }
  return (1 - sourceBonus) * getYield(start) + sourceBonus * getYield(start + 1);
};

const p = 0.7155999538617701;
const step = 1 + 1 / p;
const rate = () => p;

closeTo(enhancementMaterialFlow({ start: 0, target: 3, successRate: rate }).expectedInputs, step ** 3);

const varyingRates = [0.5, 0.6, 0.7];
closeTo(enhancementMaterialFlow({
  start: 0, target: 3, successRate: (level) => varyingRates[level],
}).expectedInputs, varyingRates.reduce((need, value) => need * (1 + 1 / value), 1));

const exactOne = enhancementMaterialFlow({
  start: 0, target: 1, successRate: rate, bonusRate: 0.1, goal: "exact",
});
closeTo(exactOne.expectedInputs, (1 + p) / (p * 0.9));

const atLeastOne = enhancementMaterialFlow({
  start: 0, target: 1, successRate: rate, bonusRate: 0.1, goal: "atLeast",
});
closeTo(atLeastOne.expectedInputs, step);

const exactTwo = enhancementMaterialFlow({
  start: 0, target: 2, successRate: rate, bonusRate: 0.1, goal: "exact",
});
closeTo(exactTwo.expectedInputs, 5.475307383133895);

const sourceBonus = enhancementMaterialFlow({
  start: 0, target: 1, successRate: rate, bonusRate: 0.1, sourceBonusRate: 0.1, goal: "exact",
});
const sourceTargetYield = 0.1 + 0.9 * p * 0.9 / (1 + p);
closeTo(sourceBonus.expectedInputs, 1 / sourceTargetYield);

// +2 산출은 대기하고 다음 단계 산출과 합쳐진 뒤 자기 차례에 강화된다.
const pooled = enhancementMaterialFlow({
  start: 0, target: 3, successRate: rate, bonusRate: 0.1, sourceBonusRate: 0.1, goal: "exact",
});
const [level0, level1, level2] = pooled.levels;
closeTo(level1.available, 0.1 + level0.normalOutput);
closeTo(level2.available, level0.bonusOutput + level1.normalOutput);
closeTo(pooled.targetYield, level1.bonusOutput + level2.normalOutput);
closeTo(pooled.overshootYield, level2.bonusOutput);

// 순방향과 독립 역산을 경계값·가변 성공률까지 전수 대조한다.
const successProfiles = [
  () => 0,
  () => 0.1,
  () => 0.5,
  () => 0.75,
  (level) => [0.23, 0.61, 0.74][level % 3],
];
for (const start of [0, 2]) for (let distance = 0; distance <= 10; distance++) {
  const target = start + distance;
  for (const successRate of successProfiles) for (const bonusRate of [0, 0.05, 0.125, 0.5, 1]) {
    for (const sourceBonusRate of [0, 0.1, 0.5, 1]) for (const goal of ["exact", "atLeast"]) {
      const options = { start, target, successRate, bonusRate, sourceBonusRate, goal };
      const forward = enhancementMaterialFlow(options);
      const backward = backwardTargetYield(options);
      closeRelative(forward.targetYield, backward);
      if (backward > 0) closeRelative(forward.expectedInputs, 1 / backward);
      else assert.equal(forward.expectedInputs, Infinity);
      for (const level of forward.levels) {
        closeRelative(level.available, level.attempts * (1 + level.successRate));
        closeRelative(level.normalOutput + level.bonusOutput, level.attempts * level.successRate);
      }
    }
  }
}

const screenshotCase = enhancementMaterialFlow({
  start: 0, target: 10, successRate: rate, bonusRate: 0.125, sourceBonusRate: 0.125, goal: "exact",
});
closeTo(screenshotCase.expectedInputs, 1858.2389898682761);
const screenshotScale = screenshotCase.expectedInputs;
const screenshotLevel8 = screenshotCase.levels.find(({ level }) => level === 8);
const screenshotLevel9 = screenshotCase.levels.find(({ level }) => level === 9);
closeTo((screenshotLevel8.bonusOutput + screenshotLevel9.normalOutput) * screenshotScale, 1);
closeTo(screenshotLevel8.bonusOutput * screenshotScale, 0.23129250890977843);
closeTo(screenshotLevel9.normalOutput * screenshotScale, 0.7687074910902216);

closeTo(enhancementMaterialFlow({
  start: 0, target: 0, successRate: rate, sourceBonusRate: 0.1, goal: "exact",
}).expectedInputs, 1 / 0.9);
closeTo(enhancementMaterialFlow({
  start: 0, target: 0, successRate: rate, sourceBonusRate: 0.1, goal: "atLeast",
}).expectedInputs, 1);

assert.equal(enhancementMaterialFlow({
  start: 0, target: 1, successRate: rate, bonusRate: 1, goal: "exact",
}).expectedInputs, Infinity);

console.log("enhancement_ev tests passed");
