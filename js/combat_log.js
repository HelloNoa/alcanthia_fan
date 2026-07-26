const ENGRAVING_SKILL_NAMES = {
  fluorescence_burst: "형광 폭발",
  crystal_absorb: "마력 흡수",
  amber_stun: "고대의 속박",
};

const STATUS_NAMES = {
  confusion: "혼란", stealth: "은신", burn: "화상", regen: "재생", mp_regen: "MP 재생",
  evasion: "회피", atk_buff: "ATK", def_buff: "DEF", taunt: "도발", mp_cost_reduce: "마나 절약",
  poison: "중독", stun: "스턴", sleep: "수면", heal_block: "회복 불가", cc_immune: "CC 면역",
  undying: "불사", afterimage: "잔상", frozen: "빙결", blind: "실명", splash: "공명",
  damage_reflect: "반사", dmg_cap: "피해 상한", def_pierce: "관통", anti_magic: "항마",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function formatSeconds(seconds) {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  return minutes ? `${minutes}분 ${rounded % 60}초` : `${rounded}초`;
}

export function renderCombatFlow(sample, {
  allyCount = 0,
  allyLabel = "아군",
  enemyLabel = "적",
  title = "대표 전투 흐름",
  itemName = (code) => code,
  secondsForTurn = null,
} = {}) {
  const stateValue = (value) => {
    const safe = Math.max(0, Number(value) || 0);
    return safe > 0 && safe < 1 ? "&lt;1" : Math.round(safe).toLocaleString("ko-KR");
  };
  const start = sample.events.find((event) => event.type === "battle_start");
  const initialUnits = start?.snapshots || [];
  const unitById = new Map(initialUnits.map((unit) => [unit.unitId, unit]));
  const allyIds = new Set((start?.allies || []).map((unit) => unit.id || unit.unitId));
  if (!allyIds.size && allyCount) {
    initialUnits.slice(0, allyCount).forEach((unit) => allyIds.add(unit.unitId));
  }
  const allyOrder = initialUnits.filter((unit) => allyIds.has(unit.unitId)).map((unit) => unit.unitId);
  const enemyOrder = initialUnits.filter((unit) => !allyIds.has(unit.unitId)).map((unit) => unit.unitId);
  const isAlly = (unitId) => allyIds.has(unitId);
  const engravingIds = new Set(Object.keys(ENGRAVING_SKILL_NAMES));

  const statsFor = (events) => {
    const stats = { dealt: 0, taken: 0, healed: 0, potions: 0, engravings: 0, kills: 0, losses: 0 };
    events.forEach((event) => {
      if (event.type === "potion_use") stats.potions += 1;
      if (engravingIds.has(event.skillId)) stats.engravings += 1;
      if (event.type === "defeat") {
        if (isAlly(event.unitId)) stats.losses += 1;
        else stats.kills += 1;
      }
      (event.hpChanges || []).forEach((change) => {
        if (change.delta < 0) {
          if (isAlly(change.unitId)) stats.taken += -change.delta;
          else stats.dealt += -change.delta;
        } else if (change.delta > 0 && isAlly(change.unitId)) {
          stats.healed += change.delta;
        }
      });
    });
    Object.keys(stats).forEach((key) => { stats[key] = Math.round(stats[key]); });
    return stats;
  };

  const changeMarkup = (event) => {
    const changes = [];
    const addChange = (change, stat) => {
      if (!change.delta) return;
      const unit = unitById.get(change.unitId);
      const side = isAlly(change.unitId) ? "ally" : "enemy";
      const tone = stat === "HP"
        ? (change.delta > 0 ? "heal" : side === "ally" ? "bad" : "good")
        : "mp";
      const sign = change.delta > 0 ? "+" : "-";
      const remaining = stat === "HP" && Number.isFinite(change.newHp)
        ? `<small>→ ${stateValue(change.newHp)} 남음</small>`
        : "";
      changes.push(`<span class="adv-change ${tone}"><span>${escapeHtml(unit?.name || change.unitId)}</span><b>${sign}${Math.round(Math.abs(change.delta))} ${stat}</b>${remaining}</span>`);
    };
    (event.hpChanges || []).forEach((change) => addChange(change, "HP"));
    (event.mpChanges || []).forEach((change) => addChange(change, "MP"));
    return changes.join("");
  };

  const actionName = (event, actor) => {
    if (event.type === "potion_use") return itemName(event.itemCode);
    if (event.type === "defeat") return "전투 불능";
    if (event.type === "status_effect") return "상태 효과";
    if (event.type === "crystal_divination") return "수정 점술";
    if (ENGRAVING_SKILL_NAMES[event.skillId]) return ENGRAVING_SKILL_NAMES[event.skillId];
    return actor?.skills?.find((skill) => skill.id === event.skillId)?.name || "행동";
  };

  const eventMarkup = (event) => {
    const eventUnitId = event.actorId
      || event.unitId
      || event.hpChanges?.[0]?.unitId
      || event.mpChanges?.[0]?.unitId;
    const actor = unitById.get(eventUnitId);
    const side = actor ? (isAlly(eventUnitId) ? "ally" : "enemy") : "system";
    const engraving = engravingIds.has(event.skillId);
    const text = event.text
      || (event.type === "defeat" ? `${event.unitName || actor?.name || "대상"} 전투 불능` : "상태 변경");
    const icon = actor
      ? `<span class="adv-event-unit" data-battle-unit="${escapeHtml(eventUnitId)}"></span>`
      : `<span class="adv-event-unit system">·</span>`;
    return `<div class="adv-event ${side}${engraving ? " engraving" : ""}${event.type === "defeat" ? " defeat" : ""}">
      ${icon}
      <div class="adv-event-main">
        <div class="adv-event-head"><b>${escapeHtml(actor?.name || event.unitName || "전투")}</b><span>${escapeHtml(actionName(event, actor))}</span></div>
        <div class="adv-event-text">${escapeHtml(text)}</div>
        <div class="adv-event-changes">${changeMarkup(event)}</div>
      </div>
    </div>`;
  };

  const teamMarkup = (ids, label, side, snapshotMap) => {
    const units = ids.map((id) => snapshotMap.get(id) || unitById.get(id)).filter(Boolean);
    const alive = units.filter((unit) => unit.hp > 0).length;
    return `<div class="adv-state-team ${side}">
      <div class="adv-state-title"><b>${escapeHtml(label)}</b><span>${alive}/${units.length}</span></div>
      ${units.map((unit) => {
        const hp = Math.max(0, unit.hp || 0);
        const maxHp = Math.max(1, unit.maxHp || 1);
        const mp = Math.max(0, unit.mp || 0);
        const maxMp = Math.max(0, unit.maxMp || 0);
        const hpPct = clamp(hp / maxHp * 100, 0, 100);
        const mpPct = maxMp ? clamp(mp / maxMp * 100, 0, 100) : 0;
        const critical = hp > 0 && hp < 1;
        const statuses = (unit.statusEffects || [])
          .filter((status) => status.turnsLeft !== 0)
          .slice(0, 4)
          .map((status) => `<span class="adv-status" title="${escapeHtml(status.type)}">${escapeHtml(STATUS_NAMES[status.type] || status.type)}${status.turnsLeft != null ? ` ${status.turnsLeft}T` : ""}</span>`)
          .join("");
        return `<div class="adv-state-unit${hp <= 0 ? " dead" : ""}${critical ? " critical" : ""}" style="--hp:${hpPct.toFixed(1)}%;--mp:${mpPct.toFixed(1)}%">
          <span class="adv-state-icon" data-battle-unit="${escapeHtml(unit.unitId)}"></span>
          <b class="adv-state-name">${escapeHtml(unit.name)}</b>
          <span class="adv-state-bars"><i class="adv-hp-track"><i></i></i>${maxMp ? `<i class="adv-mp-track"><i></i></i>` : ""}</span>
          <span class="adv-state-value">${stateValue(hp)}/${stateValue(maxHp)}${maxMp ? `<small>MP ${Math.round(mp)}/${Math.round(maxMp)}</small>` : ""}</span>
          ${statuses ? `<span class="adv-state-statuses">${statuses}</span>` : ""}
        </div>`;
      }).join("")}
    </div>`;
  };

  const groups = new Map();
  sample.events.forEach((event) => {
    if (!event.turn || event.turn < 1) return;
    if (!groups.has(event.turn)) groups.set(event.turn, { events: [], snapshot: null });
    const group = groups.get(event.turn);
    if (event.snapshots) group.snapshot = event.snapshots;
    if (!["battle_start", "battle_end", "turn_start"].includes(event.type)) group.events.push(event);
  });

  let latestSnapshot = initialUnits;
  const turns = [];
  for (let turn = 1; turn <= sample.totalTurns; turn++) {
    const group = groups.get(turn) || { events: [], snapshot: null };
    if (group.snapshot) latestSnapshot = group.snapshot;
    const snapshotMap = new Map(latestSnapshot.map((unit) => [unit.unitId, unit]));
    const stats = statsFor(group.events);
    const open = sample.totalTurns <= 8 || turn <= 2 || turn === sample.totalTurns;
    const timeMarkup = secondsForTurn
      ? `<span class="adv-turn-time">누적 ${formatSeconds(secondsForTurn(turn))}</span>`
      : "";
    turns.push(`<details class="adv-turn"${open ? " open" : ""}>
      <summary>
        <b>${turn}턴</b>
        <span class="adv-turn-metric dealt">가한 피해 ${stats.dealt.toLocaleString("ko-KR")}</span>
        <span class="adv-turn-metric taken">받은 피해 ${stats.taken.toLocaleString("ko-KR")}</span>
        ${stats.kills ? `<span class="adv-turn-metric kills">처치 ${stats.kills}</span>` : ""}
        ${stats.engravings ? `<span class="adv-turn-metric engraving">세공 ${stats.engravings}</span>` : ""}
        ${timeMarkup}
      </summary>
      <div class="adv-turn-content">
        <div class="adv-events">${group.events.length ? group.events.map(eventMarkup).join("") : `<div class="adv-event-empty">행동 없음</div>`}</div>
        <div class="adv-turn-state">${teamMarkup(allyOrder, allyLabel, "ally", snapshotMap)}${teamMarkup(enemyOrder, enemyLabel, "enemy", snapshotMap)}</div>
      </div>
    </details>`);
  }

  const totals = statsFor(sample.events);
  const engravingCounts = Object.entries(ENGRAVING_SKILL_NAMES).map(([skillId, label]) => ({
    label,
    count: sample.events.filter((event) => event.skillId === skillId).length,
  })).filter(({ count }) => count > 0);
  const engravingText = engravingCounts.length
    ? engravingCounts.map(({ label, count }) => `${label} ${count}회`).join(" · ")
    : "발동 없음";
  const actionCount = sample.events.filter((event) => event.text).length;
  const emptyMarkup = sample.totalTurns === 0
    ? `<div class="adv-event-empty">방어 파티가 없어 전투 없이 승리합니다.</div>`
    : "";

  return {
    allyIds,
    unitById,
    markup: `<section class="adv-combat-flow">
      <div class="adv-flow-head"><b>${escapeHtml(title)}</b><span>${actionCount}개 행동</span></div>
      <div class="adv-combat-stats">
        <span><small>가한 피해</small><b>${totals.dealt.toLocaleString("ko-KR")}</b></span>
        <span><small>받은 피해</small><b>${totals.taken.toLocaleString("ko-KR")}</b></span>
        <span><small>회복</small><b>${totals.healed.toLocaleString("ko-KR")}</b></span>
        <span><small>포션 사용</small><b>${totals.potions}회</b></span>
        <span><small>세공 발동</small><b>${totals.engravings}회</b></span>
      </div>
      <div class="adv-engraving-summary"><span>세공</span><b>${escapeHtml(engravingText)}</b></div>
      ${emptyMarkup}
      <div class="adv-turn-list">${turns.join("")}</div>
    </section>`,
  };
}

export function hydrateCombatIcons(root, combatFlow, {
  renderAlly,
  renderEnemy,
} = {}) {
  root.querySelectorAll("[data-battle-unit]").forEach((element) => {
    const unit = combatFlow.unitById.get(element.dataset.battleUnit);
    if (!unit?.spriteKey) return;
    const renderer = combatFlow.allyIds.has(unit.unitId) ? renderAlly : renderEnemy;
    renderer?.(element, unit.spriteKey, "adv-battle-img");
  });
}
