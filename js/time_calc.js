const TYPE_META = {
  general: { label: "소재·일반", order: 0 },
  equipment: { label: "장비", order: 1 },
  tool: { label: "도구", order: 2 },
  produce: { label: "산물", order: 3 },
  seed: { label: "씨앗", order: 4 },
  potion: { label: "포션", order: 5 },
};

export function enhancementTimeCatalog(gameData) {
  const excluded = new Set([
    ...(gameData.test_items || []),
    ...(gameData.unobtainable || []),
  ]);

  return Object.entries(gameData.items || {})
    .filter(([code, item]) => {
      const duration = Number(item?.brewDuration_ms);
      return !excluded.has(code)
        && !/^aging_/.test(code)
        && !(item?.name || "").includes("시험용")
        && Number.isFinite(duration)
        && duration > 0;
    })
    .map(([code, item]) => ({
      code,
      item,
      typeLabel: TYPE_META[item.type]?.label || "기타",
      typeOrder: TYPE_META[item.type]?.order ?? 99,
    }))
    .sort((a, b) => a.typeOrder - b.typeOrder
      || a.item.brewDuration_ms - b.item.brewDuration_ms
      || (a.item.name || a.code).localeCompare(b.item.name || b.code, "ko"));
}

export function enhancementAttemptBaseMs(gameData, code, currentEnhancement) {
  const duration = Number(gameData.items?.[code]?.brewDuration_ms);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const rawEnhancement = Number(currentEnhancement);
  const enhancement = Number.isFinite(rawEnhancement)
    ? Math.max(0, Math.floor(rawEnhancement))
    : 0;
  return duration * Math.pow(2, enhancement);
}
