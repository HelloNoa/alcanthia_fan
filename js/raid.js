import { api, gamedata } from "./api.js";
import { raidWinRate, simulateRaid } from "./battle.js";
import { escapeHtml, hydrateCombatIcons, renderCombatFlow } from "./combat_log.js";
import {
  combineRaidRates,
  describeRaidAvailability,
  normalizeRaidProfile,
  raidAttackerOpeningChance,
  stealthOpeningChance,
  wardingStoneMultiplier,
} from "./raid_profile.js";
import { createSearchPicker } from "./search_picker.js";
import { adventurerIcon, itemIcon } from "./sprites.js";

const RAID_STORE = "alc_raid_sim_v1";
const RAID_TRIALS = 1000;
const RAID_SEED = 20260723;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const clamp = (value, min, max) => Math.max(
  min,
  Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min),
);
const percent = (value, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const averageTurn = (value) => value == null ? "-" : `${value.toFixed(1)}턴`;

function normalizeEditableParty(rawParty) {
  const raw = rawParty && typeof rawParty === "object" ? rawParty : {};
  return {
    adventurers: (Array.isArray(raw.adventurers) ? raw.adventurers : [])
      .filter((member) => member && member.id)
      .slice(0, 4)
      .map((member) => ({
        id: String(member.id),
        equip: member.equip ? String(member.equip) : undefined,
        equipEnh: clamp(member.equipEnh, 0, 99),
        engraved: (Array.isArray(member.engraved) ? member.engraved : []).map((gem) => (
          gem && (gem.itemCode || gem.code)
            ? {
              itemCode: String(gem.itemCode || gem.code),
              enhancement: clamp(gem.enhancement ?? gem.enh, 0, 20),
            }
            : null
        )),
      })),
    potions: (Array.isArray(raw.potions) ? raw.potions : [])
      .filter((potion) => potion && (potion.code || potion.itemCode))
      .slice(0, 4)
      .map((potion) => ({
        code: String(potion.code || potion.itemCode),
        enh: clamp(potion.enh ?? potion.enhancement, 0, 40),
      })),
  };
}

function readStoredSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(RAID_STORE) || "null");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeStoredSettings(settings) {
  try { localStorage.setItem(RAID_STORE, JSON.stringify(settings)); } catch {}
}

function userQuery(query) {
  const value = String(query || "").trim();
  return UUID_PATTERN.test(value) ? { userId: value } : { nickname: value };
}

function roleName(type) {
  return ({
    dealer: "딜러",
    tank: "탱커",
    healer: "힐러",
    support: "지원",
    nuker: "누커",
  })[type] || type || "";
}

function makeProfileErrorMarkup(errors) {
  if (!errors?.length) return "";
  return `<div class="raid-data-errors">
    <b>정확도 확인 필요</b>
    ${errors.map((error) => `<span>${escapeHtml(error)}</span>`).join("")}
    <small>공개 정보 또는 최신 게임데이터가 충분하지 않아 시뮬레이션을 실행하지 않습니다.</small>
  </div>`;
}

export async function raidSim(body) {
  const gameData = await gamedata();
  const adventurerEntries = Object.entries(gameData.adventurers || {})
    .sort(([, left], [, right]) => (left.grade || 0) - (right.grade || 0)
      || left.name.localeCompare(right.name));
  const equipmentCodes = Object.keys(gameData.equipment_stats || {})
    .sort((left, right) => (gameData.items?.[left]?.name || left)
      .localeCompare(gameData.items?.[right]?.name || right));
  const gemCodes = Object.keys(gameData.gem_effects || {})
    .sort((left, right) => (gameData.items?.[left]?.name || left)
      .localeCompare(gameData.items?.[right]?.name || right));
  const potionCodes = Object.keys(gameData.potion_combat || {})
    .sort((left, right) => (gameData.items?.[left]?.name || left)
      .localeCompare(gameData.items?.[right]?.name || right));
  const itemName = (code) => gameData.items?.[code]?.name || code;

  const adventurerChoices = adventurerEntries.map(([code, adventurer]) => ({
    code,
    label: `${adventurer.name} · ${adventurer.title || roleName(adventurer.type)}`,
    detail: `${roleName(adventurer.type)} · ★${adventurer.grade || 0}`,
    keywords: `${adventurer.name} ${adventurer.title || ""} ${adventurer.type || ""}`,
    iconKey: adventurer.spriteKey,
  }));
  const equipmentChoices = [
    { code: "", label: "장비 없음" },
    ...equipmentCodes.map((code) => ({
      code,
      label: itemName(code),
      detail: ["atk", "def", "hp", "mp"]
        .filter((stat) => gameData.equipment_stats[code]?.[stat])
        .map((stat) => `${stat.toUpperCase()} ${gameData.equipment_stats[code][stat]}`)
        .join(" · "),
    })),
  ];
  const gemChoices = [
    { code: "", label: "빈 소켓" },
    ...gemCodes.map((code) => ({ code, label: itemName(code) })),
  ];
  const potionChoices = potionCodes.map((code) => ({ code, label: itemName(code) }));

  const stored = readStoredSettings();
  let attackerProfile = null;
  let defenderProfile = null;
  let attackerParty = { adventurers: [], potions: [] };
  let stealthEnhancement = stored.stealthEnhancement == null
    ? null
    : clamp(stored.stealthEnhancement, 0, 40);
  let lastResult = null;

  body.innerHTML = `
    <div class="raid-sim">
      <div class="raid-title-row">
        <div>
          <h3>🛡️ 실제 유저 습격 시뮬레이터</h3>
          <p class="muted">공개 방어 파티를 기준으로 계산하며 게임 서버에 습격을 요청하지 않습니다.</p>
        </div>
        <span class="raid-readonly">읽기 전용</span>
      </div>

      <div class="raid-user-grid">
        <section class="raid-user-panel defender">
          <div class="raid-panel-head">
            <div><span class="raid-side-label">방어</span><b>방어 유저 불러오기</b></div>
            <span class="muted">실제 공개 정보 고정</span>
          </div>
          <form class="raid-user-search" id="raid-defender-form">
            <input id="raid-defender-query" type="search" autocomplete="off" placeholder="닉네임 또는 유저 ID" aria-label="방어 유저 검색">
            <button type="submit">불러오기</button>
          </form>
          <div id="raid-defender-profile" class="raid-profile-state">방어 유저를 불러오세요.</div>
          <div id="raid-defender-party"></div>
        </section>

        <section class="raid-user-panel attacker">
          <div class="raid-panel-head">
            <div><span class="raid-side-label">공격</span><b>공격 유저 불러오기</b></div>
            <span class="muted">불러온 뒤 편집 가능</span>
          </div>
          <form class="raid-user-search" id="raid-attacker-form">
            <input id="raid-attacker-query" type="search" autocomplete="off" placeholder="닉네임 또는 유저 ID" aria-label="공격 유저 검색">
            <button type="submit">불러오기</button>
          </form>
          <div id="raid-attacker-profile" class="raid-profile-state">공격 유저를 불러오세요.</div>
          <div id="raid-attacker-party"></div>
        </section>
      </div>

      <section class="raid-rules">
        <div class="raid-opening-settings">
          <div class="raid-opening-row">
            <span id="raid-stealth-icon" class="raid-rule-icon"></span>
            <label for="raid-stealth"><b>공격 은신포션</b></label>
            <select id="raid-stealth">
              <option value="">미사용</option>
              ${Array.from({ length: 41 }, (_, enhancement) => (
                `<option value="${enhancement}">+${enhancement}</option>`
              )).join("")}
            </select>
            <span id="raid-stealth-rate" class="raid-opening-rate"></span>
          </div>
          <div class="raid-opening-row">
            <span id="raid-warding-icon" class="raid-rule-icon"></span>
            <b>방어 경계석</b>
            <span id="raid-warding-rate" class="raid-opening-rate">방어 프로필에서 자동 확인</span>
          </div>
        </div>
        <div class="raid-rule-summary">
          <span>양측 1명씩 교대 행동</span>
          <span>최대 30턴</span>
          <span>수정구 점술 5레벨 · 25% 부활</span>
          <span>포션 자동 사용</span>
        </div>
      </section>

      <button id="raid-run" class="adv-run raid-run" type="button">🛡️ 습격 승률 계산 (선공별 ${RAID_TRIALS.toLocaleString("ko-KR")}회)</button>
      <div id="raid-result"></div>
      <div class="calc-note raid-note">실제 습격 가능 여부는 안내 정보로만 표시합니다. 보호 상태이거나 오늘 이미 습격한 대상이어도 가상 전투는 실행할 수 있습니다. 전리품과 1시간 생산량은 계산하지 않습니다.</div>
    </div>`;

  const query = (selector) => body.querySelector(selector);
  const resultElement = query("#raid-result");
  const attackerInput = query("#raid-attacker-query");
  const defenderInput = query("#raid-defender-query");
  const stealthSelect = query("#raid-stealth");
  stealthSelect.value = stealthEnhancement == null ? "" : String(stealthEnhancement);
  itemIcon(query("#raid-stealth-icon"), "stealth_potion", "ic");
  itemIcon(query("#raid-warding-icon"), "warding_stone", "ic");

  const settingsSnapshot = () => ({
    attackerUserId: attackerProfile?.userId || stored.attackerUserId || "",
    defenderUserId: defenderProfile?.userId || stored.defenderUserId || "",
    attackerParty,
    stealthEnhancement,
  });
  const saveSettings = () => writeStoredSettings(settingsSnapshot());
  const markChanged = () => {
    lastResult = null;
    resultElement.innerHTML = `<div class="raid-result-empty">편성이 변경되었습니다. 승률을 다시 계산하세요.</div>`;
    saveSettings();
  };
  const updateOpeningRate = () => {
    const baseChance = stealthOpeningChance(stealthEnhancement);
    const warding = defenderProfile?.wardingStones;
    const levels = warding?.enhancements || [];
    const multiplier = wardingStoneMultiplier(levels);
    const finalChance = raidAttackerOpeningChance(stealthEnhancement, levels);

    query("#raid-stealth-rate").textContent = stealthEnhancement == null
      ? "은신 미사용 · 방어 선공"
      : levels.length
        ? `기본 ${percent(baseChance)} → 최종 ${percent(finalChance)}`
        : `공격 선공 ${percent(baseChance)} · 실패 시 방어 선공`;

    const wardingRate = query("#raid-warding-rate");
    if (!defenderProfile) {
      wardingRate.textContent = "방어 프로필에서 자동 확인";
    } else if (!warding?.known) {
      wardingRate.textContent = "텃밭 정보가 없어 확인 불가";
    } else if (!levels.length) {
      wardingRate.textContent = "효과가 켜진 경계석 없음";
    } else {
      const highest = Math.max(...levels);
      const ignored = levels.length - 1;
      wardingRate.textContent = `최고 +${highest} 적용`
        + `${ignored ? ` · 나머지 ${ignored}개 제외` : ""}`
        + ` · 은신 선공 ×${percent(multiplier)}`;
    }
  };

  const renderProfileState = (side, normalized, loadingMessage = "") => {
    const element = query(`#raid-${side}-profile`);
    if (loadingMessage) {
      element.className = "raid-profile-state loading";
      element.textContent = loadingMessage;
      return;
    }
    if (!normalized) {
      element.className = "raid-profile-state";
      element.textContent = `${side === "attacker" ? "공격" : "방어"} 유저를 불러오세요.`;
      return;
    }
    const availability = describeRaidAvailability(normalized.raidAvailability);
    element.className = `raid-profile-state loaded${side === "defender" && availability.canRaid === false ? " blocked" : ""}`;
    element.innerHTML = `
      <div class="raid-profile-name">
        <b>${escapeHtml(normalized.nickname || "이름 없음")}</b>
        <span>모험가 ${normalized.party.adventurers.length} · 포션 ${normalized.party.potions.length}</span>
      </div>
      ${side === "defender" ? `<div class="raid-availability ${availability.canRaid === true ? "open" : availability.canRaid === false ? "closed" : ""}">
        ${escapeHtml(availability.label)}
      </div>` : `<div class="raid-import-note">공개 방어 파티를 공격 편성의 시작값으로 불러왔습니다.</div>`}
      ${makeProfileErrorMarkup(normalized.errors)}`;
  };

  const appendIcon = (element, renderer, key, className = "ic") => {
    if (key) renderer(element, key, className);
  };

  const renderReadOnlyParty = () => {
    const element = query("#raid-defender-party");
    element.replaceChildren();
    if (!defenderProfile) return;
    const { adventurers, potions } = defenderProfile.party;
    if (!adventurers.length) {
      element.innerHTML = `<div class="raid-empty-party"><b>방어 파티 없음</b><span>게임 규칙에 따라 공격 측이 전투 없이 승리합니다.</span></div>`;
      return;
    }

    const memberList = document.createElement("div");
    memberList.className = "raid-readonly-members";
    adventurers.forEach((member) => {
      const adventurer = gameData.adventurers?.[member.id];
      const card = document.createElement("article");
      card.className = "raid-readonly-member";
      card.innerHTML = `
        <span class="raid-member-avatar"></span>
        <div class="raid-member-copy">
          <div><b>${escapeHtml(adventurer?.name || member.id)}</b><span>${escapeHtml(adventurer?.title || roleName(adventurer?.type))}</span></div>
          <div class="raid-equipment-line">
            <span class="raid-equipment-icon"></span>
            <span>${member.equip ? `${escapeHtml(itemName(member.equip))} +${member.equipEnh}` : "장비 없음"}</span>
          </div>
          <div class="raid-gem-list"></div>
        </div>`;
      memberList.appendChild(card);
      appendIcon(card.querySelector(".raid-member-avatar"), adventurerIcon, adventurer?.spriteKey, "raid-avatar-img");
      appendIcon(card.querySelector(".raid-equipment-icon"), itemIcon, member.equip, "ic");
      const gemList = card.querySelector(".raid-gem-list");
      if (!member.engraved?.length) {
        gemList.innerHTML = `<span class="muted">세공 없음</span>`;
      } else {
        member.engraved.forEach((gem) => {
          const chip = document.createElement("span");
          chip.className = "raid-gem-chip";
          chip.innerHTML = `<i></i><span>${escapeHtml(itemName(gem.itemCode))} +${gem.enhancement}</span>`;
          gemList.appendChild(chip);
          appendIcon(chip.querySelector("i"), itemIcon, gem.itemCode, "ic");
        });
      }
    });
    element.appendChild(memberList);

    const potionBlock = document.createElement("div");
    potionBlock.className = "raid-readonly-potions";
    potionBlock.innerHTML = `<b>방어 포션</b><div></div>`;
    const potionList = potionBlock.querySelector("div");
    if (!potions.length) {
      potionList.innerHTML = `<span class="muted">포션 없음</span>`;
    } else {
      potions.forEach((potion) => {
        const chip = document.createElement("span");
        chip.className = "raid-potion-chip";
        chip.innerHTML = `<i></i><span>${escapeHtml(itemName(potion.code))} +${potion.enh}</span>`;
        potionList.appendChild(chip);
        appendIcon(chip.querySelector("i"), itemIcon, potion.code, "ic");
      });
    }
    element.appendChild(potionBlock);
  };

  const editableErrors = () => {
    const errors = [];
    if (!attackerProfile) errors.push("공격 유저를 불러와야 합니다.");
    if (!defenderProfile) errors.push("방어 유저를 불러와야 합니다.");
    if (attackerProfile?.errors?.length) errors.push(...attackerProfile.errors);
    if (defenderProfile?.errors?.length) errors.push(...defenderProfile.errors);
    if (stealthEnhancement != null && defenderProfile && !defenderProfile.wardingStones?.known) {
      errors.push("방어 텃밭 정보가 없어 경계석 효과를 확인할 수 없습니다.");
    }
    if (!attackerParty.adventurers.length) errors.push("공격 모험가를 1명 이상 편성해야 합니다.");
    if (!attackerParty.potions.length) errors.push("실제 습격 규칙상 공격 포션이 최소 1개 필요합니다.");
    if (attackerProfile && attackerParty.adventurers.length > attackerProfile.caps.adventurers) {
      errors.push(`공격 유저의 파티 한도는 ${attackerProfile.caps.adventurers}명입니다.`);
    }
    if (attackerProfile && attackerParty.potions.length > attackerProfile.caps.potions) {
      errors.push(`공격 유저의 포션 한도는 ${attackerProfile.caps.potions}개입니다.`);
    }
    const seen = new Set();
    attackerParty.adventurers.forEach((member) => {
      if (!gameData.adventurers?.[member.id]) errors.push(`알 수 없는 공격 모험가: ${member.id}`);
      if (seen.has(member.id)) errors.push(`같은 모험가는 한 번만 편성할 수 있습니다: ${gameData.adventurers?.[member.id]?.name || member.id}`);
      seen.add(member.id);
      if (member.equip && !gameData.equipment_stats?.[member.equip]) errors.push(`알 수 없는 공격 장비: ${member.equip}`);
      (member.engraved || []).filter(Boolean).forEach((gem) => {
        if (!gameData.gem_effects?.[gem.itemCode]) errors.push(`알 수 없는 공격 세공: ${gem.itemCode}`);
      });
    });
    attackerParty.potions.forEach((potion) => {
      if (!gameData.potion_combat?.[potion.code]) errors.push(`알 수 없는 공격 포션: ${potion.code}`);
    });
    return [...new Set(errors)];
  };

  const renderEditableParty = () => {
    const element = query("#raid-attacker-party");
    element.replaceChildren();
    if (!attackerProfile) return;

    const partyHeader = document.createElement("div");
    partyHeader.className = "raid-edit-section-head";
    partyHeader.innerHTML = `<div><b>공격 모험가</b><span>${attackerParty.adventurers.length}/${attackerProfile.caps.adventurers}</span></div>`;
    const addMemberButton = document.createElement("button");
    addMemberButton.type = "button";
    addMemberButton.className = "adv-add";
    addMemberButton.textContent = "+ 모험가";
    addMemberButton.disabled = attackerParty.adventurers.length >= attackerProfile.caps.adventurers;
    addMemberButton.onclick = () => {
      const next = adventurerEntries.find(([id]) => !attackerParty.adventurers.some((member) => member.id === id));
      if (!next) return;
      attackerParty.adventurers.push({ id: next[0], equip: undefined, equipEnh: 0, engraved: [] });
      markChanged();
      renderEditableParty();
    };
    partyHeader.appendChild(addMemberButton);
    element.appendChild(partyHeader);

    const memberList = document.createElement("div");
    memberList.className = "raid-edit-members";
    attackerParty.adventurers.forEach((member, memberIndex) => {
      member.engraved ||= [];
      const card = document.createElement("article");
      card.className = "raid-edit-member";
      const main = document.createElement("div");
      main.className = "raid-edit-main";
      main.innerHTML = `
        <span data-picker="adventurer"></span>
        <span data-picker="equipment"></span>
        <label class="adv-enh">+<input type="number" min="0" max="99" value="${member.equipEnh || 0}" aria-label="장비 강화도"></label>
        <button type="button" class="adv-x" aria-label="모험가 제외" title="모험가 제외">✕</button>`;
      card.appendChild(main);
      main.querySelector('[data-picker="adventurer"]').replaceWith(createSearchPicker({
        value: member.id,
        choices: adventurerChoices,
        placeholder: "모험가 검색",
        ariaLabel: `공격 모험가 ${memberIndex + 1} 검색`,
        className: "adv-adventurer-picker",
        iconRenderer: (holder, choice, imageClass) => adventurerIcon(holder, choice.iconKey, imageClass),
        onSelect: (code) => {
          attackerParty.adventurers[memberIndex].id = code;
          markChanged();
          renderEditableParty();
        },
      }));
      main.querySelector('[data-picker="equipment"]').replaceWith(createSearchPicker({
        value: member.equip || "",
        choices: equipmentChoices,
        placeholder: "장비 검색",
        ariaLabel: `${gameData.adventurers?.[member.id]?.name || "모험가"} 장비 검색`,
        className: "adv-equip-picker",
        iconRenderer: (holder, choice, imageClass) => itemIcon(holder, choice.code, imageClass),
        onSelect: (code) => {
          attackerParty.adventurers[memberIndex].equip = code || undefined;
          if (!code) attackerParty.adventurers[memberIndex].engraved = [];
          markChanged();
          renderEditableParty();
        },
      }));
      main.querySelector('input[type="number"]').oninput = (event) => {
        member.equipEnh = clamp(event.target.value, 0, 99);
        event.target.value = member.equipEnh;
        markChanged();
      };
      main.querySelector(".adv-x").onclick = () => {
        attackerParty.adventurers.splice(memberIndex, 1);
        markChanged();
        renderEditableParty();
      };

      const sockets = document.createElement("div");
      sockets.className = "adv-sockets raid-sockets";
      member.engraved.forEach((slot, socketIndex) => {
        const row = document.createElement("div");
        row.className = "adv-socket-row";
        row.innerHTML = `
          <span class="adv-socket-label">소켓 ${socketIndex + 1}</span>
          <span data-picker="gem"></span>
          <label class="adv-enh">+<input type="number" min="0" max="20" value="${slot?.enhancement || 0}" aria-label="세공 강화도"${slot ? "" : " disabled"}></label>
          <button type="button" class="adv-x adv-socket-x" aria-label="소켓 삭제" title="소켓 삭제">✕</button>`;
        sockets.appendChild(row);
        row.querySelector('[data-picker="gem"]').replaceWith(createSearchPicker({
          value: slot?.itemCode || "",
          choices: gemChoices,
          placeholder: "세공 검색",
          ariaLabel: `소켓 ${socketIndex + 1} 세공 검색`,
          className: "adv-gem-picker",
          iconRenderer: (holder, choice, imageClass) => itemIcon(holder, choice.code, imageClass),
          onSelect: (code) => {
            const previous = member.engraved[socketIndex]?.enhancement || 0;
            member.engraved[socketIndex] = code ? { itemCode: code, enhancement: previous } : null;
            markChanged();
            renderEditableParty();
          },
        }));
        row.querySelector('input[type="number"]').oninput = (event) => {
          if (!member.engraved[socketIndex]) return;
          member.engraved[socketIndex].enhancement = clamp(event.target.value, 0, 20);
          event.target.value = member.engraved[socketIndex].enhancement;
          markChanged();
        };
        row.querySelector(".adv-socket-x").onclick = () => {
          member.engraved.splice(socketIndex, 1);
          markChanged();
          renderEditableParty();
        };
      });
      const addSocketButton = document.createElement("button");
      addSocketButton.type = "button";
      addSocketButton.className = "adv-add adv-add-socket";
      addSocketButton.textContent = "+ 소켓";
      addSocketButton.disabled = !member.equip;
      addSocketButton.title = member.equip ? "세공 소켓 추가" : "장비를 먼저 선택하세요";
      addSocketButton.onclick = () => {
        if (!member.equip) return;
        member.engraved.push(null);
        markChanged();
        renderEditableParty();
      };
      sockets.appendChild(addSocketButton);
      card.appendChild(sockets);
      memberList.appendChild(card);
    });
    element.appendChild(memberList);

    const potionHeader = document.createElement("div");
    potionHeader.className = "raid-edit-section-head potion";
    potionHeader.innerHTML = `<div><b>공격 포션</b><span>${attackerParty.potions.length}/${attackerProfile.caps.potions} · 최소 1개</span></div>`;
    const addPotionButton = document.createElement("button");
    addPotionButton.type = "button";
    addPotionButton.className = "adv-add";
    addPotionButton.textContent = "+ 포션";
    addPotionButton.disabled = attackerParty.potions.length >= attackerProfile.caps.potions;
    addPotionButton.onclick = () => {
      if (!potionCodes.length) return;
      attackerParty.potions.push({ code: potionCodes[0], enh: 0 });
      markChanged();
      renderEditableParty();
    };
    potionHeader.appendChild(addPotionButton);
    element.appendChild(potionHeader);

    const potionList = document.createElement("div");
    potionList.className = "raid-edit-potions";
    if (!attackerParty.potions.length) {
      potionList.innerHTML = `<div class="raid-required-warning">실행하려면 공격 포션을 1개 이상 추가하세요.</div>`;
    }
    attackerParty.potions.forEach((potion, potionIndex) => {
      const row = document.createElement("div");
      row.className = "adv-row";
      row.innerHTML = `
        <span data-picker="potion"></span>
        <label class="adv-enh">+<input type="number" min="0" max="40" value="${potion.enh}" aria-label="포션 강화도"></label>
        <button type="button" class="adv-x" aria-label="포션 제외" title="포션 제외">✕</button>`;
      potionList.appendChild(row);
      row.querySelector('[data-picker="potion"]').replaceWith(createSearchPicker({
        value: potion.code,
        choices: potionChoices,
        placeholder: "포션 검색",
        ariaLabel: `공격 포션 ${potionIndex + 1} 검색`,
        iconRenderer: (holder, choice, imageClass) => itemIcon(holder, choice.code, imageClass),
        onSelect: (code) => {
          attackerParty.potions[potionIndex].code = code;
          markChanged();
          renderEditableParty();
        },
      }));
      row.querySelector('input[type="number"]').oninput = (event) => {
        potion.enh = clamp(event.target.value, 0, 40);
        event.target.value = potion.enh;
        markChanged();
      };
      row.querySelector(".adv-x").onclick = () => {
        attackerParty.potions.splice(potionIndex, 1);
        markChanged();
        renderEditableParty();
      };
    });
    element.appendChild(potionList);
  };

  const renderAllProfiles = () => {
    renderProfileState("attacker", attackerProfile);
    renderProfileState("defender", defenderProfile);
    renderEditableParty();
    renderReadOnlyParty();
    updateOpeningRate();
  };

  async function loadProfile(side, rawQuery, { restoreDraft = false } = {}) {
    const value = String(rawQuery || "").trim();
    if (!value) {
      const state = query(`#raid-${side}-profile`);
      state.className = "raid-profile-state error";
      state.textContent = "닉네임 또는 유저 ID를 입력하세요.";
      return;
    }
    const form = query(`#raid-${side}-form`);
    const button = form.querySelector("button");
    button.disabled = true;
    renderProfileState(side, null, "공개 프로필을 불러오는 중...");
    try {
      const payload = await api.garden(userQuery(value));
      const normalized = normalizeRaidProfile(payload, gameData);
      if (side === "attacker") {
        attackerProfile = normalized;
        const canRestore = restoreDraft
          && stored.attackerUserId === normalized.userId
          && stored.attackerParty;
        attackerParty = normalizeEditableParty(canRestore ? stored.attackerParty : normalized.party);
        attackerInput.value = normalized.nickname || normalized.userId;
      } else {
        defenderProfile = normalized;
        defenderInput.value = normalized.nickname || normalized.userId;
      }
      lastResult = null;
      resultElement.innerHTML = "";
      saveSettings();
      renderAllProfiles();
    } catch (error) {
      const state = query(`#raid-${side}-profile`);
      state.className = "raid-profile-state error";
      state.textContent = `프로필을 불러오지 못했습니다: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  }

  const rawLogMarkup = (sample) => {
    const rows = sample.events.filter((event) => event.text)
      .map((event) => `<div class="adv-log-r"><span class="adv-log-t">${event.turn}T</span> ${escapeHtml(event.text)}</div>`)
      .join("");
    return `<details class="adv-logbox"><summary>원문 로그 (${sample.events.filter((event) => event.text).length}줄)</summary>
      <div class="adv-log">${rows || `<div class="muted">전투 로그 없음</div>`}</div>
    </details>`;
  };

  const renderRepresentative = (mode) => {
    if (!lastResult) return;
    const sample = mode === "attacker" ? lastResult.attackerSample : lastResult.defenderSample;
    const label = mode === "attacker" ? "공격 선공" : "방어 선공";
    const flow = renderCombatFlow(sample, {
      allyCount: attackerParty.adventurers.length,
      allyLabel: "공격",
      enemyLabel: "방어",
      title: `${label} 대표 전투 흐름`,
      itemName,
    });
    const sampleElement = query("#raid-sample-body");
    sampleElement.innerHTML = `
      <div class="adv-sample ${sample.victory ? "win" : "lose"}">
        ${label}: ${sample.victory ? "공격 승리" : "방어 승리"} · ${sample.totalTurns ? `${sample.totalTurns}턴` : "전투 없음"}
      </div>
      ${flow.markup}
      ${rawLogMarkup(sample)}`;
    hydrateCombatIcons(sampleElement, flow, {
      renderAlly: adventurerIcon,
      renderEnemy: adventurerIcon,
    });
    query("#raid-log-tabs").querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
  };

  const renderResult = (defenderFirst, attackerFirst, combined, attackerFirstChance, defenderSample, attackerSample) => {
    const turnDistribution = Object.entries(combined.winTurnProbabilities)
      .sort((left, right) => Number(left[0]) - Number(right[0]));
    const distributionMarkup = turnDistribution.length
      ? `<div class="raid-turn-distribution">
          <div class="raid-result-section-head"><b>승리 턴 분포</b><span>최종 승리 중 비율</span></div>
          <div>${turnDistribution.map(([turn, probability]) => {
            const share = combined.rate ? probability / combined.rate : 0;
            return `<span class="raid-turn-bar" style="--share:${(share * 100).toFixed(2)}%">
              <b>${Number(turn) === 0 ? "전투 없음" : `${turn}턴`}</b>
              <i><i></i></i>
              <small>${percent(share)}</small>
            </span>`;
          }).join("")}</div>
        </div>`
      : "";

    lastResult = { defenderSample, attackerSample };
    resultElement.innerHTML = `
      <section class="raid-result-summary">
        <div class="raid-final-rate">
          <span>최종 습격 승률</span>
          <b>${percent(combined.rate)}</b>
          <small>은신·경계석 반영 선공 확률 ${percent(attackerFirstChance)} 가중</small>
        </div>
        <div class="raid-conditional-grid">
          <article>
            <span>방어 선공</span>
            <b>${percent(defenderFirst.rate)}</b>
            <small>${defenderFirst.wins.toLocaleString("ko-KR")}승 / ${defenderFirst.trials.toLocaleString("ko-KR")}회</small>
          </article>
          <article>
            <span>공격 선공</span>
            <b>${percent(attackerFirst.rate)}</b>
            <small>${attackerFirst.wins.toLocaleString("ko-KR")}승 / ${attackerFirst.trials.toLocaleString("ko-KR")}회</small>
          </article>
          <article>
            <span>승리 시 평균</span>
            <b>${averageTurn(combined.avgTurnsOnWin)}</b>
            <small>두 선공 조건 가중</small>
          </article>
          <article>
            <span>패배 시 평균</span>
            <b>${averageTurn(combined.avgTurnsOnLoss)}</b>
            <small>최대 30턴</small>
          </article>
        </div>
      </section>
      ${distributionMarkup}
      <section class="raid-representative">
        <div class="raid-result-section-head"><b>대표 전투</b><span>선공 조건별 고정 시드</span></div>
        <div id="raid-log-tabs" class="raid-log-tabs">
          <button type="button" data-mode="defender" class="active">방어 선공</button>
          <button type="button" data-mode="attacker">공격 선공</button>
        </div>
        <div id="raid-sample-body"></div>
      </section>`;
    query("#raid-log-tabs").querySelectorAll("button").forEach((button) => {
      button.onclick = () => renderRepresentative(button.dataset.mode);
    });
    renderRepresentative("defender");
  };

  async function runSimulation() {
    const errors = editableErrors();
    if (errors.length) {
      resultElement.innerHTML = `<div class="err-box"><b>시뮬레이션을 실행할 수 없습니다.</b>${errors.map((error) => `<span>${escapeHtml(error)}</span>`).join("")}</div>`;
      return;
    }
    const runButton = query("#raid-run");
    runButton.disabled = true;
    runButton.textContent = `선공별 ${RAID_TRIALS.toLocaleString("ko-KR")}회 계산 중...`;
    resultElement.innerHTML = `<div class="raid-result-empty">양측 편성과 포션을 적용해 전투를 계산하고 있습니다.</div>`;
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    try {
      const defenderFirst = raidWinRate(
        attackerParty,
        defenderProfile.party,
        gameData,
        "enemy_first_interleaved",
        RAID_TRIALS,
        RAID_SEED,
      );
      const attackerFirst = raidWinRate(
        attackerParty,
        defenderProfile.party,
        gameData,
        "ally_first_interleaved",
        RAID_TRIALS,
        RAID_SEED,
      );
      const attackerFirstChance = raidAttackerOpeningChance(
        stealthEnhancement,
        defenderProfile.wardingStones?.enhancements,
      );
      const combined = combineRaidRates(defenderFirst, attackerFirst, attackerFirstChance);
      const defenderSample = simulateRaid(
        attackerParty,
        defenderProfile.party,
        gameData,
        "enemy_first_interleaved",
        RAID_SEED,
      );
      const attackerSample = simulateRaid(
        attackerParty,
        defenderProfile.party,
        gameData,
        "ally_first_interleaved",
        RAID_SEED,
      );
      renderResult(
        defenderFirst,
        attackerFirst,
        combined,
        attackerFirstChance,
        defenderSample,
        attackerSample,
      );
    } catch (error) {
      resultElement.innerHTML = `<div class="err-box">시뮬레이션 오류: ${escapeHtml(error.message)}</div>`;
    } finally {
      runButton.disabled = false;
      runButton.textContent = `🛡️ 습격 승률 계산 (선공별 ${RAID_TRIALS.toLocaleString("ko-KR")}회)`;
    }
  }

  query("#raid-attacker-form").onsubmit = (event) => {
    event.preventDefault();
    loadProfile("attacker", attackerInput.value);
  };
  query("#raid-defender-form").onsubmit = (event) => {
    event.preventDefault();
    loadProfile("defender", defenderInput.value);
  };
  stealthSelect.onchange = () => {
    stealthEnhancement = stealthSelect.value === "" ? null : clamp(stealthSelect.value, 0, 40);
    updateOpeningRate();
    markChanged();
  };
  query("#raid-run").onclick = runSimulation;

  updateOpeningRate();
  renderAllProfiles();

  const initialLoads = [];
  if (stored.attackerUserId) {
    attackerInput.value = stored.attackerUserId;
    initialLoads.push(loadProfile("attacker", stored.attackerUserId, { restoreDraft: true }));
  }
  if (stored.defenderUserId) {
    defenderInput.value = stored.defenderUserId;
    initialLoads.push(loadProfile("defender", stored.defenderUserId, { restoreDraft: true }));
  }
  await Promise.all(initialLoads);
}
