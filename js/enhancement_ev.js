const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

// 장기 반복 시 강화도별 기대 공급량을 흘려 정확한 목표 강화도 산출률을 구한다.
export function enhancementMaterialFlow({
  start = 0,
  target = 0,
  successRate,
  bonusRate = 0,
  sourceBonusRate = 0,
  goal = "exact",
}) {
  if (typeof successRate !== "function") throw new TypeError("successRate must be a function");
  if (goal !== "exact" && goal !== "atLeast") throw new RangeError("goal must be exact or atLeast");

  start = Math.max(0, Math.floor(Number(start) || 0));
  target = Math.max(start, Math.floor(Number(target) || 0));
  const bonus = clamp01(bonusRate);
  const sourceBonus = clamp01(sourceBonusRate);
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

  // 제작·양조 산출도 석양절벽 발동 시 시작 강화도보다 1 높게 유입될 수 있다.
  addOutput(start, 1 - sourceBonus);
  addOutput(start + 1, sourceBonus);

  for (let level = start; level < target; level++) {
    const available = supply[level - start];
    if (!(available > 0)) continue;
    const p = clamp01(successRate(level));
    // 한 번에 2개를 쓰고 실패 시 1개를 돌려받으므로 시도당 기대 순소모는 1+p다.
    const attempts = available / (1 + p);
    const normalOutput = attempts * p * (1 - bonus);
    const bonusOutput = attempts * p * bonus;
    addOutput(level + 1, normalOutput);
    addOutput(level + 2, bonusOutput);
    levels.push({ level, available, successRate: p, attempts, normalOutput, bonusOutput });
  }

  return {
    expectedInputs: targetYield > 0 ? 1 / targetYield : Infinity,
    targetYield,
    overshootYield,
    levels,
  };
}
