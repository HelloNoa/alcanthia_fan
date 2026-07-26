import { parseEngravings, parseItemKey } from "./item_key.js";

const RAID_AVAILABILITY_REASONS = {
  mist_town: "안개마을 거주자는 습격할 수 없습니다.",
  fog_not_liberated: "안개가 해방되지 않아 습격할 수 없습니다.",
  attacked_today: "오늘 이미 습격한 대상입니다.",
  relocation_protection: "이주 보호가 적용 중입니다.",
  recent_defeat_protection: "최근 습격 패배 보호가 적용 중입니다.",
};

const clamp = (value, min, max) => Math.max(
  min,
  Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min),
);

function equipmentKeyFor(profile, defenseParty, member, adventurerId) {
  if (member && typeof member === "object") {
    if (member.itemKey) return member.itemKey;
    if (member.equipment?.itemKey) return member.equipment.itemKey;
    if (member.equip) {
      const suffix = `+${Math.max(0, Number(member.equipEnh) || 0)}`;
      const engraved = (member.engraved || [])
        .filter(Boolean)
        .map((slot) => `${slot.itemCode || slot.code}+${Math.max(0, Number(slot.enhancement ?? slot.enh) || 0)}`)
        .join(",");
      return `${member.equip}${suffix}${engraved ? `(${engraved})` : ""}`;
    }
  }

  const direct = defenseParty?.equipment?.[adventurerId]
    || defenseParty?.adventurerEquipment?.[adventurerId]
    || profile?.adventurerEquipment?.[adventurerId];
  return typeof direct === "string" ? direct : direct?.itemKey;
}

function normalizePotion(raw) {
  if (typeof raw === "string") {
    const parsed = parseItemKey(raw);
    return { code: parsed.code, enh: clamp(parsed.enhancement, 0, 40) };
  }
  if (!raw || typeof raw !== "object") return null;
  if (raw.itemKey) return normalizePotion(raw.itemKey);
  return {
    code: String(raw.code || raw.itemCode || ""),
    enh: clamp(raw.enh ?? raw.enhancement, 0, 40),
  };
}

function normalizeWardingStones(profile, payload) {
  const grid = Array.isArray(profile?.grid)
    ? profile.grid
    : (Array.isArray(payload?.grid) ? payload.grid : null);
  if (!grid) return { known: false, enhancements: [] };

  const enhancements = [];
  grid.forEach((row) => {
    if (!Array.isArray(row)) return;
    row.forEach((cell) => {
      const ornament = cell?.ornament;
      if (!ornament || ornament.effectEnabled === false) return;
      (Array.isArray(ornament.items) ? ornament.items : []).forEach((rawItem) => {
        const itemKey = typeof rawItem === "string" ? rawItem : rawItem?.itemKey;
        if (!itemKey) return;
        const parsed = parseItemKey(itemKey);
        if (parsed.code === "warding_stone") {
          enhancements.push(clamp(parsed.enhancement, 0, 999));
        }
      });
    });
  });

  return {
    known: true,
    enhancements: enhancements.sort((left, right) => right - left),
  };
}

export function normalizeRaidProfile(payload, gameData) {
  const profile = payload?.profile || payload || {};
  const defenseParty = profile.gardenRaidDefenseParty;
  const rawMembers = Array.isArray(defenseParty?.adventurers)
    ? defenseParty.adventurers
    : (Array.isArray(defenseParty?.adventurerIds) ? defenseParty.adventurerIds : []);
  const adventurers = [];
  const errors = [];
  if (profile.profileDetailsVisible === false && defenseParty == null) {
    errors.push("프로필 상세 정보가 비공개라 방어 파티를 확인할 수 없습니다.");
  }

  rawMembers.forEach((member, index) => {
    const id = typeof member === "string"
      ? member
      : String(member?.id || member?.adventurerId || "");
    if (!id) {
      errors.push(`방어 파티 ${index + 1}번 모험가 ID가 없습니다.`);
      return;
    }
    if (!gameData?.adventurers?.[id]) {
      errors.push(`최신 게임데이터에 없는 모험가입니다: ${id}`);
    }

    const rawEquipment = equipmentKeyFor(profile, defenseParty, member, id);
    const parsed = rawEquipment ? parseItemKey(rawEquipment) : null;
    if (parsed?.code && !gameData?.equipment_stats?.[parsed.code]) {
      errors.push(`최신 게임데이터에 없는 장비입니다: ${parsed.code}`);
    }

    const engraved = parsed ? parseEngravings(parsed.engravings) : [];
    engraved.forEach(({ itemCode }) => {
      if (!gameData?.gem_effects?.[itemCode]) {
        errors.push(`최신 게임데이터에 없는 세공입니다: ${itemCode}`);
      }
    });

    adventurers.push({
      id,
      equip: parsed?.code || undefined,
      equipEnh: parsed?.enhancement || 0,
      engraved,
    });
  });

  const potions = (Array.isArray(defenseParty?.potions) ? defenseParty.potions : [])
    .map(normalizePotion)
    .filter(Boolean);
  potions.forEach(({ code }) => {
    if (!code) errors.push("코드가 없는 포션이 포함되어 있습니다.");
    else if (!gameData?.potion_combat?.[code]) {
      errors.push(`최신 게임데이터에 없는 포션입니다: ${code}`);
    }
  });

  const spellLevels = profile.spellLevels || {};
  let raidAvailability = profile.raidAvailability || payload?.raidAvailability || null;
  if (!raidAvailability && Object.hasOwn(profile, "currentZone") && profile.currentZone == null) {
    raidAvailability = { canRaid: false, reason: "mist_town" };
  } else if (!raidAvailability && spellLevels.fog_liberation === 0) {
    raidAvailability = { canRaid: false, reason: "fog_not_liberated" };
  }
  return {
    userId: String(profile.userId || payload?.userId || ""),
    nickname: String(profile.nickname || payload?.nickname || ""),
    party: { adventurers, potions },
    caps: {
      adventurers: clamp(spellLevels.bond_rune || Math.max(1, adventurers.length), 1, 4),
      potions: clamp(1 + (spellLevels.levitation || 0), 1, 4),
    },
    wardingStones: normalizeWardingStones(profile, payload),
    raidAvailability,
    errors: [...new Set(errors)],
  };
}

export function describeRaidAvailability(availability) {
  if (!availability) return {
    canRaid: null,
    label: "실제 습격 가능 여부를 확인할 수 없습니다.",
  };
  if (availability.canRaid) return {
    canRaid: true,
    label: "현재 게임에서 습격 가능한 상태입니다.",
  };

  const rawReason = availability.reason
    || availability.code
    || availability.blockReason
    || availability.reasonCode;
  return {
    canRaid: false,
    label: RAID_AVAILABILITY_REASONS[rawReason]
      || availability.message
      || `현재 게임에서는 습격할 수 없습니다${rawReason ? ` (${rawReason})` : ""}.`,
  };
}

export function stealthOpeningChance(enhancement) {
  if (enhancement === null || enhancement === undefined || enhancement === "") return 0;
  const level = clamp(enhancement, 0, 40);
  return 1 - (0.9 ** (level + 1));
}

export function wardingStoneMultiplier(enhancements) {
  const levels = Array.isArray(enhancements) ? enhancements : [];
  if (levels.length > 1) return null;
  if (!levels.length) return 1;
  return 0.9 ** (clamp(levels[0], 0, 999) + 1);
}

export function raidAttackerOpeningChance(stealthEnhancement, wardingEnhancements = []) {
  const stealthChance = stealthOpeningChance(stealthEnhancement);
  if (!stealthChance) return 0;
  const wardingMultiplier = wardingStoneMultiplier(wardingEnhancements);
  return wardingMultiplier == null ? null : stealthChance * wardingMultiplier;
}

export function combineRaidRates(defenderFirst, attackerFirst, attackerFirstChance) {
  const opening = clamp(attackerFirstChance, 0, 1);
  const branches = [
    { result: defenderFirst, weight: 1 - opening },
    { result: attackerFirst, weight: opening },
  ];
  const rate = branches.reduce((sum, branch) => sum + branch.weight * branch.result.rate, 0);
  const lossRate = 1 - rate;
  const weightedWinTurns = branches.reduce((sum, branch) => (
    sum + branch.weight * branch.result.rate * (branch.result.avgTurnsOnWin || 0)
  ), 0);
  const weightedLossTurns = branches.reduce((sum, branch) => (
    sum + branch.weight * (1 - branch.result.rate) * (branch.result.avgTurnsOnLoss || 0)
  ), 0);
  const turnProbabilities = {};
  branches.forEach(({ result, weight }) => {
    Object.entries(result.winTurnCounts || {}).forEach(([turn, count]) => {
      turnProbabilities[turn] = (turnProbabilities[turn] || 0)
        + weight * count / Math.max(1, result.trials);
    });
  });

  return {
    rate,
    avgTurnsOnWin: rate ? weightedWinTurns / rate : null,
    avgTurnsOnLoss: lossRate ? weightedLossTurns / lossRate : null,
    winTurnProbabilities: turnProbabilities,
  };
}
