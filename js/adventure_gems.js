const GEM_LABELS = {
  refined_amber: "호박석 (공격 시 스턴)",
  refined_fluorite: "형석 (피격 누적 반격)",
  refined_crystal: "수정 (피격 시 MP 환원)",
  refined_onyx: "오닉스 (습격 전용 피해 감소 · 모험 효과 없음)",
};

export function adventureGemChoices(gameData) {
  const items = gameData?.items || {};
  const effects = gameData?.gem_effects || {};
  return Object.keys(effects)
    .sort((a, b) => (items[a]?.name || a).localeCompare(items[b]?.name || b))
    .map((code) => ({
      code,
      label: GEM_LABELS[code] || `${items[code]?.name || code} (${effects[code]?.name || "세공"})`,
    }));
}
