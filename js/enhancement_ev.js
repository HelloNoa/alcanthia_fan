const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function finishingMasteryRate(level = 0, cauldron = 0) {
  const skill = Math.min(10, Math.max(0, Math.floor(Number(level) || 0)));
  const tool = Math.min(99, Math.max(0, Math.floor(Number(cauldron) || 0)));
  return 1 - (1 - 0.005 * skill) ** (tool + 1);
}

export function craftingSourceDistribution(finishRate = 0, sunsetRate = 0) {
  const f = clamp01(finishRate), s = clamp01(sunsetRate);
  return [(1 - f) * (1 - s), f * (1 - s) + (1 - f) * s, f * s];
}

export function enhancementGoalForTarget(target) {
  return Math.max(0, Math.floor(Number(target) || 0)) === 0 ? "atLeast" : "exact";
}

export function formatExpectedQuantity(value) {
  if (!Number.isFinite(value)) return "도달 불가";
  const digits = value < 0.1 ? 3 : value < 10 ? 2 : value < 1000 ? 1 : 0;
  return value.toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function enhancementResultBonusRate({ zone = "", itemType = "", zoneEffectCoeff = 0 } = {}) {
  const coeff = Math.max(0, Number(zoneEffectCoeff) || 0);
  if (zone === "sunset_cliff") return clamp01(0.05 * coeff);
  if (zone === "mid_cave" && itemType === "general") return clamp01(0.04 * coeff);
  return 0;
}

// 장기 반복 시 강화도별 기대 공급량을 흘려 정확한 목표 강화도 산출률을 구한다.
export function enhancementMaterialFlow({
  start = 0,
  target = 0,
  successRate,
  bonusRate = 0,
  sourceBonusRate = 0,
  sourceDistribution,
  failureRestoreRate = 0,
  goal = "exact",
}) {
  if (typeof successRate !== "function") throw new TypeError("successRate must be a function");
  if (goal !== "exact" && goal !== "atLeast") throw new RangeError("goal must be exact or atLeast");

  start = Math.max(0, Math.floor(Number(start) || 0));
  target = Math.max(start, Math.floor(Number(target) || 0));
  const bonus = clamp01(bonusRate);
  const sourceBonus = clamp01(sourceBonusRate);
  const restore = clamp01(failureRestoreRate);
  const supply = Array(target - start + 1).fill(0);
  const levels = [];
  let targetYield = 0;
  let overshootYield = 0;

  const addOutput = (level, amount) => {
    if (!(amount > 0)) return;
    const reachesGoal = goal === "atLeast" ? level >= target : level === target;
    if (reachesGoal) targetYield += amount;
    else if (level < target) supply[level - start] += amount;
    else overshootYield += amount;
  };

  // 제작은 마감 숙련과 석양이 중첩되어 +2까지, 양조는 석양으로 +1까지 유입된다.
  const source = sourceDistribution || [1 - sourceBonus, sourceBonus];
  source.forEach((rate, offset) => addOutput(start + offset, rate));

  for (let level = start; level < target; level++) {
    const available = supply[level - start];
    if (!(available > 0)) continue;
    const p = clamp01(successRate(level));
    // 성공은 2개를 소모하고, 일반 실패는 1개를 회수한다.
    // 잊힌 성터가 발동한 실패는 2개 모두 반환하므로 시도당 기대 순소모에서 제외한다.
    const netConsumption = 1 + p - (1 - p) * restore;
    const attempts = netConsumption > 0 ? available / netConsumption : 0;
    const normalOutput = attempts * p * (1 - bonus);
    const bonusOutput = attempts * p * bonus;
    addOutput(level + 1, normalOutput);
    addOutput(level + 2, bonusOutput);
    levels.push({ level, available, successRate: p, failureRestoreRate: restore, attempts, normalOutput, bonusOutput });
  }

  return {
    expectedInputs: targetYield > 0 ? 1 / targetYield : Infinity,
    targetYield,
    overshootYield,
    levels,
  };
}
