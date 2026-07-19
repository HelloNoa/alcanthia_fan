// ⚔️ 모험 전투 시뮬레이터 (계산기 서브탭)
import { gamedata } from "./api.js";
import { itemIcon, monsterIcon, CDN } from "./sprites.js";
import { simulate, winRate } from "./battle.js";

const ADV_STORE = "alc_adv_sim_v1";

function advIcon(el, spriteKey, className = "ic") {
  const img = document.createElement("img");
  img.loading = "lazy"; img.className = className;
  img.onerror = () => img.remove();
  img.src = `${CDN}/npc/${spriteKey}.png`;
  el.appendChild(img);
  return img;
}

export async function advSim(body) {
  const g = await gamedata();
  const advs = Object.entries(g.adventurers || {})
    .sort((a, b) => (a[1].grade || 0) - (b[1].grade || 0) || a[1].name.localeCompare(b[1].name));
  const equips = Object.keys(g.equipment_stats || {})
    .sort((a, b) => (g.items[a]?.name || a).localeCompare(g.items[b]?.name || b));
  const potions = Object.keys(g.potion_combat || {})
    .sort((a, b) => (g.items[a]?.name || a).localeCompare(g.items[b]?.name || b));
  const zones = Object.entries(g.zones || {});
  const nm = (c) => g.items[c]?.name || c;
  const maxNightmare = Math.max(0, g.skills?.nightmare?.maxLevel || 3);
  const nightmareMult = (e) => 2 ** Math.max(0, Math.floor(+e || 0));
  // 모험 소요 시간 = (턴수+1) × 6초 (La=6000ms)
  const advSec = (turns) => (turns + 1) * 6;
  const fmtSec = (s) => { s = Math.round(s); const m = Math.floor(s / 60); return m ? `${m}분 ${s % 60}초` : `${s}초`; };

  const zoneOpts = () => zones.map(([id, z]) =>
    `<option value="${id}"${id === zoneId ? " selected" : ""}>${z.name} (${(z.monsters || []).length}마리, ${z.rule === "enemy_first" ? "적 선공" : "아군 선공"})</option>`).join("");
  const nightmareOpts = () => Array.from({ length: maxNightmare + 1 }, (_, e) => {
    const label = e === 0 ? "일반" : `악몽 ${e}단계 · HP/MP ×${nightmareMult(e)} · 전리품 +${e}회`;
    return `<option value="${e}"${e === nightmare ? " selected" : ""}>${label}</option>`;
  }).join("");
  // 전투 세공 3종 (배틀엔진이 코드로 직접 처리)
  const GEMS = [
    { code: "refined_amber", label: "호박석 (공격시 스턴)" },
    { code: "refined_fluorite", label: "형석 (피격누적 반격)" },
    { code: "refined_crystal", label: "수정 (피격시 MP환원)" },
  ];
  const statSummary = (code) => {
    const stats = g.equipment_stats[code] || {};
    return ["atk", "def", "hp", "mp"].filter((key) => stats[key])
      .map((key) => `${key.toUpperCase()} ${stats[key]}`).join(" · ");
  };
  const roleName = (type) => ({ dealer: "딜", tank: "탱", healer: "힐", support: "지원", nuker: "누커" }[type] || type);
  const adventurerChoices = advs.map(([code, adventurer]) => ({
    code,
    label: `${adventurer.name} · ${adventurer.title}`,
    detail: `${roleName(adventurer.type)} · ★${adventurer.grade}`,
    keywords: `${adventurer.name} ${adventurer.title} ${adventurer.type} ${roleName(adventurer.type)} ${adventurer.grade}`,
    iconKey: adventurer.spriteKey,
  }));
  const equipChoices = [
    { code: "", label: "장비 없음" },
    ...equips.map((code) => ({ code, label: nm(code), detail: statSummary(code) })),
  ];
  const potionChoices = potions.map((code) => ({ code, label: nm(code) }));
  const gemChoices = [
    { code: "", label: "빈 소켓" },
    ...GEMS.map(({ code, label }) => ({ code, label, detail: nm(code) })),
  ];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(+n) ? +n : min));
  const advSet = new Set(advs.map(([id]) => id));
  const eqSet = new Set(equips);
  const potSet = new Set(potions);
  const gemSet = new Set(GEMS.map((gm) => gm.code));
  const zoneSet = new Set(zones.map(([id]) => id));
  const normalizeEngraved = (p) => {
    const raw = Array.isArray(p.engraved)
      ? p.engraved
      : (gemSet.has(p.gem) ? [{ itemCode: p.gem, enhancement: p.gemEnh }] : []);
    return raw.map((slot) => {
      if (!slot) return null;
      const itemCode = slot.itemCode || slot.code;
      return gemSet.has(itemCode)
        ? { itemCode, enhancement: clamp(slot.enhancement ?? slot.enh, 0, 20) }
        : null;
    });
  };
  const defaultParty = () => advs.slice(0, 4).map(([id]) => ({ id, equip: "", equipEnh: 0, engraved: [] }));
  const loadSettings = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(ADV_STORE) || "null");
      if (!raw || typeof raw !== "object") throw new Error("empty");
      const savedParty = Array.isArray(raw.party) ? raw.party.slice(0, 4).filter((p) => p && advSet.has(p.id)).map((p) => ({
        id: p.id,
        equip: eqSet.has(p.equip) ? p.equip : "",
        equipEnh: clamp(p.equipEnh, 0, 99),
        engraved: eqSet.has(p.equip) ? normalizeEngraved(p) : [],
      })) : [];
      const savedPots = Array.isArray(raw.pots) ? raw.pots.slice(0, 4).filter((p) => p && potSet.has(p.code)).map((p) => ({
        code: p.code,
        enh: clamp(p.enh, 0, 40),
      })) : [];
      return {
        party: savedParty.length ? savedParty : defaultParty(),
        pots: savedPots,
        zoneId: zoneSet.has(raw.zoneId) ? raw.zoneId : zones[0][0],
        nightmare: clamp(raw.nightmare, 0, maxNightmare),
      };
    } catch {
      return { party: defaultParty(), pots: [], zoneId: zones[0][0], nightmare: 0 };
    }
  };

  // 상태: 파티 / 포션 / 존 (기본 4명, 최대 4)
  let { party, pots, zoneId, nightmare } = loadSettings();
  const saveSettings = () => {
    try { localStorage.setItem(ADV_STORE, JSON.stringify({ party, pots, zoneId, nightmare })); } catch {}
  };

  body.innerHTML = `
    <div class="adv-sim">
      <h3>⚔️ 모험 전투 시뮬레이터 <span class="muted">(게임 전투 로직 충실 재현)</span></h3>
      <div class="adv-sec"><div class="adv-sec-h">🧑‍🤝‍🧑 출정 모험가 <span class="muted">(장비·강화·세공)</span></div>
        <div id="adv-party"></div>
        <button id="adv-addp" class="adv-add">+ 모험가</button></div>
      <div class="adv-sec"><div class="adv-sec-h">🧪 휴대 포션 <span class="muted">(전투 중 자동 사용)</span></div>
        <div id="adv-pots"></div>
        <button id="adv-addpot" class="adv-add">+ 포션</button></div>
      <div class="adv-sec"><div class="adv-sec-h">🗺️ 모험 지역</div>
        <div class="adv-zone-row"><select id="adv-zone" class="num-in">${zoneOpts()}</select>
          <select id="adv-nightmare" class="num-in">${nightmareOpts()}</select>
          <button id="adv-rec" class="adv-rec">🎯 이 지역 추천 파티</button></div>
        <div id="adv-nightmare-note" class="adv-nightmare-note"></div>
        <div id="adv-recnote"></div>
        <div id="adv-enemies" class="adv-enemies"></div></div>
      <button id="adv-run" class="adv-run">⚔️ 출정 (200회 시뮬)</button>
      <div id="adv-result"></div>
      <div class="calc-note">💡 데미지 = max(1, ATK×스킬계수×100/(100+DEF)) · 최대 30턴 · 적 전멸 시 승리.
        피해와 남은 HP는 내부적으로 소수 계산되며, 1 미만으로 생존하면 &lt;1로 표시합니다.
        스마트 유닛(아군)은 우선순위로 스킬 선택, 멍청한 몬스터는 랜덤. 승률은 200개 가상 시드 평균입니다.
        예지포션은 현재 계정의 다음 모험 시드 1개를 보여주므로, 같은 편성·같은 휴대 포션이면 반복 사용해도 같은 결과가 나올 수 있습니다.</div>
    </div>`;

  const q = (s) => body.querySelector(s);
  let itemPickerSeq = 0;

  const createPicker = ({
    value, choices, placeholder, ariaLabel, className = "", onSelect,
    iconRenderer = (el, choice, imageClass) => itemIcon(el, choice.code, imageClass),
  }) => {
    const picker = document.createElement("div");
    picker.className = `adv-item-picker ${className}`.trim();

    const icon = document.createElement("span");
    icon.className = "adv-item-selected-icon";
    icon.setAttribute("aria-hidden", "true");

    const input = document.createElement("input");
    input.type = "search";
    input.className = "adv-pick adv-item-search";
    input.placeholder = placeholder;
    input.autocomplete = "off";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-label", ariaLabel);
    input.setAttribute("aria-expanded", "false");

    const options = document.createElement("div");
    const pickerId = ++itemPickerSeq;
    options.id = `adv-item-options-${pickerId}`;
    options.className = "adv-item-options";
    options.setAttribute("role", "listbox");
    options.hidden = true;
    input.setAttribute("aria-controls", options.id);
    picker.append(icon, input, options);

    let selectedCode = choices.some((choice) => choice.code === value) ? value : (choices[0]?.code || "");
    let visibleChoices = [];
    let activeIndex = -1;

    const selectedChoice = () => choices.find((choice) => choice.code === selectedCode);
    const restoreSelection = () => {
      const selected = selectedChoice();
      input.value = selected?.label || "";
      input.title = selected ? [selected.label, selected.detail].filter(Boolean).join(" · ") : "";
    };
    const renderSelectedIcon = () => {
      const selected = selectedChoice();
      const renderCode = selectedCode;
      icon.replaceChildren();
      icon.hidden = !renderCode;
      icon.title = selected?.label || "";
      picker.classList.toggle("has-selected-item", Boolean(renderCode));
      if (!renderCode || !selected) return;
      const holder = document.createElement("span");
      Promise.resolve(iconRenderer(holder, selected, "adv-item-selected-img")).then(() => {
        if (selectedCode === renderCode && picker.isConnected) icon.replaceChildren(...holder.children);
      });
    };
    const closeOptions = () => {
      options.hidden = true;
      picker.classList.remove("is-open");
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
    };
    const dismissOptions = () => {
      restoreSelection();
      closeOptions();
    };
    picker.dismissItemOptions = dismissOptions;

    const setActive = (index) => {
      const optionEls = [...options.querySelectorAll(".adv-item-option")];
      if (!optionEls.length) return;
      activeIndex = (index + optionEls.length) % optionEls.length;
      optionEls.forEach((option, i) => {
        const active = i === activeIndex;
        option.classList.toggle("active", active);
        option.setAttribute("aria-selected", String(active));
      });
      const active = optionEls[activeIndex];
      input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    };
    const choose = (choice) => {
      selectedCode = choice.code;
      restoreSelection();
      renderSelectedIcon();
      closeOptions();
      onSelect(choice.code);
    };
    const renderOptions = (rawTerm = input.value) => {
      const term = rawTerm.trim().toLocaleLowerCase("ko");
      visibleChoices = choices.filter((choice) => !term || [choice.label, choice.code, choice.detail, choice.keywords]
        .filter(Boolean).some((text) => text.toLocaleLowerCase("ko").includes(term)));
      activeIndex = -1;
      options.replaceChildren();
      if (!visibleChoices.length) {
        const empty = document.createElement("div");
        empty.className = "adv-item-empty";
        empty.textContent = "검색 결과가 없습니다.";
        options.appendChild(empty);
        return;
      }
      visibleChoices.forEach((choice, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.id = `adv-item-option-${pickerId}-${index}`;
        option.className = "adv-item-option";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");

        const optionIcon = document.createElement("span");
        optionIcon.className = "adv-item-option-icon";
        const text = document.createElement("span");
        text.className = "adv-item-option-text";
        const name = document.createElement("span");
        name.className = "adv-item-option-name";
        name.textContent = choice.label;
        text.appendChild(name);
        if (choice.detail) {
          const detail = document.createElement("span");
          detail.className = "adv-item-option-detail";
          detail.textContent = choice.detail;
          text.appendChild(detail);
        }
        const code = document.createElement("span");
        code.className = "adv-item-option-code";
        code.textContent = choice.code;
        option.append(optionIcon, text, code);
        option.onmousedown = (event) => event.preventDefault();
        option.onclick = () => choose(choice);
        options.appendChild(option);
        if (choice.code) iconRenderer(optionIcon, choice, "ic");
      });
    };
    const openOptions = (showAll = false) => {
      body.querySelectorAll(".adv-item-picker.is-open").forEach((other) => {
        if (other !== picker) other.dismissItemOptions?.();
      });
      renderOptions(showAll ? "" : input.value);
      options.hidden = false;
      picker.classList.add("is-open");
      input.setAttribute("aria-expanded", "true");
    };

    input.onfocus = () => {
      input.select();
      openOptions(true);
    };
    let wasOpenOnPointerDown = false;
    const rememberOpenState = () => { wasOpenOnPointerDown = !options.hidden; };
    const toggleFromPointer = () => {
      if (wasOpenOnPointerDown && input.value === (selectedChoice()?.label || "")) {
        dismissOptions();
        input.blur();
      } else if (options.hidden) {
        input.focus();
        input.select();
        if (options.hidden) openOptions(true);
      }
    };
    input.onpointerdown = rememberOpenState;
    input.onclick = () => {
      toggleFromPointer();
    };
    input.oninput = () => openOptions();
    input.onsearch = () => openOptions();
    input.onkeydown = (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (options.hidden) openOptions(true);
        setActive(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
      } else if (event.key === "Enter" && !options.hidden) {
        event.preventDefault();
        if (activeIndex >= 0) choose(visibleChoices[activeIndex]);
        else if (visibleChoices.length === 1) choose(visibleChoices[0]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        dismissOptions();
      }
    };
    picker.onfocusout = () => setTimeout(() => {
      if (!picker.contains(document.activeElement)) dismissOptions();
    }, 0);
    icon.onpointerdown = rememberOpenState;
    icon.onclick = toggleFromPointer;

    restoreSelection();
    renderSelectedIcon();
    return picker;
  };

  if (body.advPickerOutsideHandler) {
    document.removeEventListener("pointerdown", body.advPickerOutsideHandler);
  }
  body.advPickerOutsideHandler = (event) => {
    body.querySelectorAll(".adv-item-picker.is-open").forEach((picker) => {
      if (!picker.contains(event.target)) picker.dismissItemOptions?.();
    });
  };
  document.addEventListener("pointerdown", body.advPickerOutsideHandler);

  const renderParty = () => {
    const el = q("#adv-party"); el.innerHTML = "";
    party.forEach((p, i) => {
      p.engraved ||= [];
      const member = document.createElement("div"); member.className = "adv-member";
      const row = document.createElement("div"); row.className = "adv-row adv-member-main";
      row.innerHTML = `
        <span data-item-picker="adventurer"></span>
        <span data-item-picker="equip"></span>
        <label class="adv-enh">+<input type="number" min="0" max="99" value="${p.equipEnh}" data-i="${i}" data-f="equipEnh" class="adv-enh-in"></label>
        <button class="adv-x" data-i="${i}" data-t="p">✕</button>`;
      member.appendChild(row);
      el.appendChild(member);
      row.querySelector('[data-item-picker="adventurer"]').replaceWith(createPicker({
        value: p.id,
        choices: adventurerChoices,
        placeholder: "모험가 이름 검색",
        ariaLabel: `출정 모험가 ${i + 1} 검색`,
        className: "adv-adventurer-picker",
        iconRenderer: (holder, choice, imageClass) => advIcon(holder, choice.iconKey, imageClass),
        onSelect: (id) => { party[i].id = id; saveSettings(); renderParty(); },
      }));
      row.querySelector('[data-item-picker="equip"]').replaceWith(createPicker({
        value: p.equip || "",
        choices: equipChoices,
        placeholder: "장비 이름 검색",
        ariaLabel: `${g.adventurers[p.id]?.name || "모험가"} 장비 검색`,
        className: "adv-equip-picker",
        onSelect: (code) => {
          party[i].equip = code;
          if (!code) party[i].engraved = [];
          saveSettings();
          renderParty();
        },
      }));

      const sockets = document.createElement("div"); sockets.className = "adv-sockets";
      p.engraved.forEach((slot, socketIndex) => {
        const socket = document.createElement("div"); socket.className = "adv-socket-row";
        socket.innerHTML = `
          <span class="adv-socket-label">소켓 ${socketIndex + 1}</span>
          <span data-item-picker="gem"></span>
          <label class="adv-enh">+<input type="number" min="0" max="20" value="${slot?.enhancement || 0}"
            data-i="${i}" data-s="${socketIndex}" data-f="enhancement" data-t="engraving"
            class="adv-enh-in" title="소켓 ${socketIndex + 1} 세공 강화도"${slot ? "" : " disabled"}></label>
          <button class="adv-x adv-socket-x" data-i="${i}" data-s="${socketIndex}" aria-label="소켓 ${socketIndex + 1} 삭제" title="소켓 삭제">✕</button>`;
        sockets.appendChild(socket);
        socket.querySelector('[data-item-picker="gem"]').replaceWith(createPicker({
          value: slot?.itemCode || "",
          choices: gemChoices,
          placeholder: "세공 검색",
          ariaLabel: `${g.adventurers[p.id]?.name || "모험가"} 소켓 ${socketIndex + 1} 세공 검색`,
          className: "adv-gem-picker",
          onSelect: (code) => {
            const previousEnhancement = party[i].engraved[socketIndex]?.enhancement || 0;
            party[i].engraved[socketIndex] = code
              ? { itemCode: code, enhancement: previousEnhancement }
              : null;
            saveSettings();
            renderParty();
          },
        }));
      });
      const addSocket = document.createElement("button");
      addSocket.type = "button";
      addSocket.className = "adv-add adv-add-socket";
      addSocket.dataset.i = i;
      addSocket.textContent = "+ 소켓";
      addSocket.disabled = !p.equip;
      addSocket.title = p.equip ? "세공 소켓 추가" : "장비를 먼저 선택하세요";
      sockets.appendChild(addSocket);
      member.appendChild(sockets);
    });
    q("#adv-addp").style.display = party.length >= 4 ? "none" : "";
  };
  const renderPots = () => {
    const el = q("#adv-pots"); el.innerHTML = "";
    if (!pots.length) { el.innerHTML = `<div class="muted" style="font-size:13px">포션 없음</div>`; return; }
    pots.forEach((p, i) => {
      const row = document.createElement("div"); row.className = "adv-row";
      row.innerHTML = `
        <span data-item-picker="pot"></span>
        <label class="adv-enh">+<input type="number" min="0" max="40" value="${p.enh}" data-i="${i}" data-f="enh" data-t="pot" class="adv-enh-in"></label>
        <button class="adv-x" data-i="${i}" data-t="pot">✕</button>`;
      el.appendChild(row);
      row.querySelector('[data-item-picker="pot"]').replaceWith(createPicker({
        value: p.code,
        choices: potionChoices,
        placeholder: "포션 이름 검색",
        ariaLabel: `휴대 포션 ${i + 1} 검색`,
        className: "adv-pot-picker",
        onSelect: (code) => { pots[i].code = code; saveSettings(); },
      }));
    });
    q("#adv-addpot").style.display = pots.length >= 4 ? "none" : "";
  };
  const renderEnemies = () => {
    const el = q("#adv-enemies"); el.innerHTML = "";
    const z = g.zones[zoneId];
    const mult = nightmareMult(nightmare);
    q("#adv-nightmare-note").innerHTML = nightmare > 0
      ? `악몽 ${nightmare}단계: 몬스터 HP·MP ×${mult}, 전리품 추가 기회 ${nightmare}회(각 25%)`
      : `일반 난이도: 몬스터 기본 HP·MP`;
    (z.monsters || []).forEach((mid) => {
      const m = g.monsters[mid]; if (!m) return;
      const c = document.createElement("span"); c.className = "adv-enemy";
      c.innerHTML = `<span class="adv-mic" data-sp="${m.spriteKey}"></span><span class="adv-mn">${m.name}</span><span class="adv-ms">HP${m.hp * mult} MP${m.mp * mult}<br>ATK${m.atk} DEF${m.def}</span>`;
      el.appendChild(c);
      monsterIcon(c.querySelector(".adv-mic"), m.spriteKey);
    });
  };

  // 후보 장비 풀: 프리미엄(다이아 포함) vs 일반(다이아 제외). 시뮬로 모험가별 최적 선택 (스킬·MP 반영)
  const EQ_ALL = ["dia_scepter", "dia_plate", "golden_charm", "mana_pendant", "gilded_copper_helm", "silver_necklace", "lava_insignia", "scale_bracelet", "arcane_ring", "platinum_breastplate"]
    .filter((c) => g.equipment_stats[c]);
  const EQ_BUDGET = EQ_ALL.filter((c) => !c.startsWith("dia_"));
  const bestInPool = (pool, stat) => pool.reduce((b, c) => (g.equipment_stats[c][stat] || 0) > (g.equipment_stats[b]?.[stat] ?? -1) ? c : b, pool[0]);
  const initEq = (type, pool) => type === "tank" ? bestInPool(pool, "def") : bestInPool(pool, "atk");
  // 고정 강화도에서 각 모험가 장비를 그리디 최적화 (승률 최대) — 스킬/MP 자동 반영
  function optimizeEquip(ids, zid, enh, pool) {
    const chosen = ids.map((id) => initEq(g.adventurers[id].type, pool));
    const wrOf = (arr) => winRate({ adventurers: ids.map((id, j) => ({ id, equip: arr[j], equipEnh: enh })), potions: [], skills: {}, difficulty: nightmare }, zid, g, 35).rate;
    for (let i = 0; i < ids.length; i++) {
      let bEq = chosen[i], bWr = wrOf(chosen);
      for (const c of pool) {
        if (c === chosen[i]) continue;
        const test = [...chosen]; test[i] = c; const w = wrOf(test);
        if (w > bWr + 0.001) { bWr = w; bEq = c; }
      }
      chosen[i] = bEq;
    }
    return chosen;
  }

  // 추천 포션 후보 (전투에 강력 — 버프·디버프·AoE·CC·부활). +5로 가정(양조가 강화보다 쉬움)
  const POT_CANDS = ["blessing_potion", "curse_potion", "meteor_potion", "lava_essence", "explosion_potion", "rejuvenation_potion"]
    .filter((c) => g.potion_combat[c]);
  const POT_ENH = 5, POT_MAXE = 15;
  // 포션 최대 4개를 그리디로 선택 — "12초(1턴) 강화도"를 가장 많이 줄이는 포션 우선(폭딜 포션 반영),
  // 12초 불가면 "클리어 강화도" 최소화. (게임 AI 자동사용 반영)
  function optimizePotions(ids, eq, zid) {
    const mkp = (e, pots) => ({ adventurers: ids.map((id, j) => ({ id, equip: eq[j], equipEnh: e })), potions: pots, skills: {}, difficulty: nightmare });
    const evalE = (pots) => {
      let clearE = null, fastE = null;
      for (let e = 0; e <= POT_MAXE; e++) {
        const r = winRate(mkp(e, pots), zid, g, 35);
        if (clearE == null && r.rate >= 0.9) clearE = e;
        if (r.rate >= 0.9 && r.avgTurnsOnWin != null && r.avgTurnsOnWin <= 1.3) { fastE = e; break; }
      }
      return { clearE, fastE };
    };
    const score = (r) => r.fastE != null ? r.fastE : 1000 + (r.clearE != null ? r.clearE : POT_MAXE + 1);  // 12초 우선, 다음 클리어
    let pots = [], cur = evalE([]);
    while (pots.length < 4) {
      let best = null, bestR = cur, bestS = score(cur);
      // 중복 허용(폭딜 포션 중첩). 동점이면 이미 고른 종류를 먼저 평가 → 같은 포션으로 모음(재료 모으기 쉬움)
      const cands = [...POT_CANDS].sort((a, b) =>
        (pots.some((p) => p.code === b) ? 1 : 0) - (pots.some((p) => p.code === a) ? 1 : 0));
      for (const c of cands) {
        const r = evalE([...pots, { code: c, enh: POT_ENH }]);
        if (score(r) < bestS) { bestS = score(r); best = c; bestR = r; }   // 첫(=중복 우선) 최저점 유지
      }
      if (!best) break;   // 더 줄이는 포션 없음
      pots.push({ code: best, enh: POT_ENH }); cur = bestR;
    }
    return { pots, clearE: cur.clearE, fastE: cur.fastE };
  }
  // 역할 적합도 점수 (스탯 — 후보 추리기용. 최종 선발은 시뮬) — 탱: 유효HP, 그 외: 공격력
  const roleScore = (a) => a.type === "tank" ? a.hp * (100 + a.def) / 100 : a.atk;
  // 편성을 시뮬로 최적화 — 보유 가능 등급(grades) 내에서 여러 편성(균형/2딜2누/딜찍누 등)·멤버 변형을
  // 시뮬로 평가해 12초(없으면 클리어) 강화도가 가장 낮은 편성 선택. (레벨·스킬행동·딜찍누 자동 반영)
  function bestParty(grades, eqPool, zid) {
    const byRole = { dealer: [], nuker: [], tank: [], support: [] };
    advs.forEach(([id, a]) => { if (grades.includes(a.grade) && byRole[a.type]) byRole[a.type].push([id, a]); });
    for (const k in byRole) byRole[k].sort((x, y) => roleScore(y[1]) - roleScore(x[1]));
    const D = byRole.dealer.map((x) => x[0]), N = byRole.nuker.map((x) => x[0]), T = byRole.tank.map((x) => x[0]), S = byRole.support.map((x) => x[0]);
    const comps = [];
    const add = (ids) => { ids = ids.filter(Boolean); if (new Set(ids).size === 4) comps.push(ids); };
    for (const d of D.slice(0, 2)) for (const n of N.slice(0, 2)) add([T[0], S[0], d, n]);  // 균형 + 딜·누 1·2순위 변형
    add([D[0], D[1], N[0], N[1]]);   // 2딜2누
    add([T[0], D[0], D[1], N[0]]);   // 1탱2딜1누
    add([S[0], D[0], D[1], N[0]]);   // 1서폿2딜1누
    add([D[0], D[1], D[2], N[0]]);   // 3딜1누
    if (D.length >= 4) add(D.slice(0, 4));   // 딜찍누
    const seen = new Set(), uniq = [];
    for (const c of comps) { const key = [...c].sort().join(","); if (!seen.has(key)) { seen.add(key); uniq.push(c); } }
    const eqOf = (id) => initEq(g.adventurers[id].type, eqPool);
    const evalComp = (ids) => {   // 기본장비 기준 12초(없으면 클리어) 강화도 — 낮을수록 좋음
      let clearE = null, fastE = null;
      for (let e = 0; e <= 12; e++) {
        const r = winRate({ adventurers: ids.map((id) => ({ id, equip: eqOf(id), equipEnh: e })), potions: [], skills: {}, difficulty: nightmare }, zid, g, 30);
        if (clearE == null && r.rate >= 0.9) clearE = e;
        if (r.rate >= 0.9 && r.avgTurnsOnWin != null && r.avgTurnsOnWin <= 1.3) { fastE = e; break; }
      }
      return fastE != null ? fastE : (clearE != null ? 1000 + clearE : 9999);
    };
    let best = uniq[0] || [D[0], N[0], T[0], S[0]].filter(Boolean), bestS = Infinity;
    for (const c of uniq) { const s = evalComp(c); if (s < bestS) { bestS = s; best = c; } }
    // 멤버 로컬서치: 각 슬롯을 같은 역할 다른 모험가로 교체해 더 낮으면 채택 (레이 첫턴 문제 등 스킬행동 반영)
    let cur = best.slice(), curS = bestS;
    for (let i = 0; i < cur.length; i++) {
      const role = g.adventurers[cur[i]].type, alts = byRole[role].map((x) => x[0]).slice(0, 4);
      for (const alt of alts) { if (cur.includes(alt)) continue; const t = cur.slice(); t[i] = alt; const s = evalComp(t); if (s < curS) { curS = s; cur = t; } }
    }
    return cur;
  }
  // 진행도 티어 — 보유 가능 모험가(★ 상한)·장비 풀이 다름. 각 티어가 그 안에서 12초(1턴) 목표, 안되면 최소 강화 클리어
  // 진행도 티어 — ★1~3·5=골드, ★4=다이아(200), ★5=존12(수정갱도) 클리어 후 골드 해금
  const SETTINGS = [
    { label: "🆓 무과금 (초반)", note: "★1~3 · 일반 장비", grades: [1, 2, 3], pool: EQ_BUDGET },
    { label: "🎓 졸업 (존12)", note: "★1~3·5 · 다이아 장비", grades: [1, 2, 3, 5], pool: EQ_ALL },
    { label: "💳 과금 (★4)", note: "★4 포함 · 다이아 장비", grades: [1, 2, 3, 4, 5], pool: EQ_ALL },
  ];
  const MAXE = 15;   // 현실적 강화 상한 (그 이상은 비현실적 → "상위 티어 필요")
  function recommendAll(zid) {
    return SETTINGS.map((a) => {
      const ids = bestParty(a.grades, a.pool, zid);
      const baseEq = ids.map((id) => initEq(g.adventurers[id].type, a.pool));
      const mk = (eq, e) => ({ adventurers: ids.map((id, j) => ({ id, equip: eq[j], equipEnh: e })), potions: [], skills: {}, difficulty: nightmare });
      let e0 = null;
      for (let e = 0; e <= MAXE; e++) { if (winRate(mk(baseEq, e), zid, g, 40).rate >= 0.85) { e0 = e; break; } }
      const eq = optimizeEquip(ids, zid, e0 != null ? e0 : MAXE, a.pool);
      // 포션을 "12초 강화도 우선, 다음 클리어 강화도" 최소화로 선택 (강화보다 양조가 쉬움)
      const { pots, clearE: rawClear, fastE: rawFast } = optimizePotions(ids, eq, zid);
      const clearE = rawClear != null && rawClear <= MAXE ? rawClear : null;
      const fastE = rawFast != null && rawFast <= MAXE ? rawFast : null;
      const mkp = (e) => ({ adventurers: ids.map((id, j) => ({ id, equip: eq[j], equipEnh: e })), potions: pots, skills: {}, difficulty: nightmare });
      const conf = clearE != null ? winRate(mkp(clearE), zid, g, 200) : null;
      // 세공(호박석 스턴) 포함 버전 — 장비·세공 동일 강화도로 묶어 최소 강화도 탐색
      const mkg = (e) => ({ adventurers: ids.map((id, j) => ({ id, equip: eq[j], equipEnh: e, engraved: [{ itemCode: "refined_amber", enhancement: e }] })), potions: pots, skills: {}, difficulty: nightmare });
      let gemClearE = null, gemFastE = null;
      for (let e = 0; e <= MAXE; e++) { const r = winRate(mkg(e), zid, g, 40); if (gemClearE == null && r.rate >= 0.9) gemClearE = e; if (r.rate >= 0.9 && r.avgTurnsOnWin != null && r.avgTurnsOnWin <= 1.3) { gemFastE = e; break; } }
      gemClearE = gemClearE != null && gemClearE <= MAXE ? gemClearE : null;
      gemFastE = gemFastE != null && gemFastE <= MAXE ? gemFastE : null;
      return { label: a.label, note: a.note, ids, equip: eq, potions: pots, clearE, fastE, gemClearE, gemFastE, achievable: clearE != null, rate: conf?.rate, avgTurns: conf?.avgTurnsOnWin };
    });
  }
  let recOptions = [];
  const applyRec = (o, gem) => {
    const e = gem ? (o.gemClearE ?? o.clearE ?? 0) : (o.clearE ?? 0);
    party = o.ids.map((id, j) => ({
      id,
      equip: o.equip[j],
      equipEnh: e,
      engraved: gem ? [{ itemCode: "refined_amber", enhancement: e }] : [],
    }));
    pots = (o.potions || []).map((p) => ({ code: p.code, enh: p.enh }));
    saveSettings(); renderParty(); renderPots();
  };

  // 입력 바인딩 (위임)
  body.addEventListener("input", (e) => {
    const t = e.target;
    if (t.type !== "number" || t.dataset.i == null) return;
    const i = +t.dataset.i;
    if (t.dataset.t === "pot") {
      if (pots[i]) pots[i].enh = Math.max(0, +t.value || 0);
    } else if (t.dataset.t === "engraving") {
      const slot = party[i]?.engraved?.[+t.dataset.s];
      if (slot) slot.enhancement = clamp(t.value, 0, 20);
    } else if (t.dataset.f === "equipEnh" && party[i]) {
      party[i].equipEnh = Math.max(0, +t.value || 0);
    } else {
      return;
    }
    saveSettings();
  });
  body.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "adv-zone") { zoneId = t.value; saveSettings(); renderEnemies(); q("#adv-recnote").innerHTML = ""; q("#adv-result").innerHTML = ""; return; }
    if (t.id === "adv-nightmare") { nightmare = clamp(t.value, 0, maxNightmare); saveSettings(); renderEnemies(); q("#adv-recnote").innerHTML = ""; q("#adv-result").innerHTML = ""; return; }
    const i = +t.dataset.i;
    if (t.dataset.t === "pot") { pots[i][t.dataset.f] = t.dataset.f === "enh" ? Math.max(0, +t.value || 0) : t.value; saveSettings(); renderPots(); }
    else if (t.dataset.t === "engraving") {
      const slot = party[i]?.engraved?.[+t.dataset.s];
      if (slot) slot.enhancement = clamp(t.value, 0, 20);
      saveSettings();
    }
    else if (t.dataset.f) {
      const num = t.dataset.f === "equipEnh";
      party[i][t.dataset.f] = num ? Math.max(0, +t.value || 0) : t.value;
      saveSettings();
    }
  });
  body.addEventListener("click", (e) => {
    const t = e.target;
    if (t.id === "adv-addp") { if (party.length < 4) { party.push({ id: advs[0][0], equip: "", equipEnh: 0, engraved: [] }); saveSettings(); renderParty(); } }
    else if (t.id === "adv-addpot") { if (pots.length < 4) { pots.push({ code: potions[0], enh: 0 }); saveSettings(); renderPots(); } }
    else if (t.classList.contains("adv-add-socket")) {
      const member = party[+t.dataset.i];
      if (member?.equip) {
        member.engraved ||= [];
        member.engraved.push(null);
        saveSettings();
        renderParty();
      }
    }
    else if (t.classList.contains("adv-socket-x")) {
      const member = party[+t.dataset.i];
      member?.engraved?.splice(+t.dataset.s, 1);
      saveSettings();
      renderParty();
    }
    else if (t.classList.contains("adv-x")) {
      const i = +t.dataset.i;
      if (t.dataset.t === "pot") { pots.splice(i, 1); saveSettings(); renderPots(); }
      else if (party.length > 1) { party.splice(i, 1); saveSettings(); renderParty(); }
    }
    else if (t.id === "adv-run") run();
    else if (t.id === "adv-rec") {
      q("#adv-recnote").innerHTML = `<div class="adv-rec-r calc">🎯 추천 파티 계산 중… <span class="muted">(잠시만요)</span></div>`;
      setTimeout(() => {
        recOptions = recommendAll(zoneId);
        q("#adv-recnote").innerHTML = `<div class="adv-rec-h">🎯 진행도별 추천 <span class="muted">(편성·장비·포션 시뮬 최적 · ★4=다이아, ★5=존12 해금 · ${nightmare > 0 ? `악몽 ${nightmare}단계` : "일반"})</span></div>
          <div class="adv-rec-tip">💡 추천 데미지 포션(유성·용암정수·폭발)은 <b>최초 클리어용</b>. 반복 12초는 <b>장비 강화 + 촉진/이끼젤리</b>가 장기적으로 유리해요.</div>` +
          recOptions.map((o, i) => {
            const pnames = o.ids.map((id, j) => `${g.adventurers[id].name}<span class="muted">(${nm(o.equip[j]).replace(/^다이아 /, "")})</span>`).join(" · ");
            if (!o.achievable) {
              return `<div class="adv-rec-card warn">
                <div class="adv-rec-top"><span class="adv-rec-lbl"><b>${o.label}</b> <span class="adv-rec-slow">❌ 클리어 어려움</span></span></div>
                <div class="adv-rec-mid">${pnames}</div>
                <div class="adv-rec-bot"><span class="muted">${o.note}</span> · +${MAXE}강으로도 부족 — <span class="down">상위 티어 필요</span></div>
              </div>`;
            }
            const turns = Math.round(o.avgTurns);
            const time = fmtSec(advSec(o.avgTurns));
            const badge = turns === 1 ? `<span class="adv-rec-fast">⚡ 12초 (1턴)</span>` : `<span class="adv-rec-slow">⏱️ ${time} (${turns}턴)</span>`;
            const fastNote = (o.fastE != null && o.fastE > o.clearE) ? ` · <span class="muted">12초는 +${o.fastE}강</span>` : "";
            const potNames = (o.potions || []).map((p) => nm(p.code)).join(" · ");
            const gemLine = (o.gemClearE != null)
              ? `<div class="adv-rec-gem">🔮 호박석 세공 시 클리어 <b>+${o.gemClearE}강</b>${o.gemClearE < o.clearE ? " <span class='up'>↓</span>" : ""}${o.gemFastE != null ? ` · 12초 +${o.gemFastE}강` : ""} <button class="adv-rec-applyg" data-ri="${i}">세공 적용</button></div>`
              : "";
            return `<div class="adv-rec-card">
              <div class="adv-rec-top"><span class="adv-rec-lbl"><b>${o.label}</b> ${badge}</span><button class="adv-rec-apply" data-ri="${i}">적용</button></div>
              <div class="adv-rec-mid">${pnames}</div>
              <div class="adv-rec-bot"><span class="muted">${o.note}</span> · 세공X 클리어 <b>+${o.clearE}강</b> · 승률 <b class="${o.rate >= 0.85 ? "up" : "down"}">${(o.rate * 100).toFixed(0)}%</b>${fastNote}${potNames ? `<br>🧪 <span class="muted">${potNames} (+${POT_ENH})</span>` : ""}</div>
              ${gemLine}
            </div>`;
          }).join("");
      }, 30);
    }
    else if (t.classList.contains("adv-rec-apply")) { applyRec(recOptions[+t.dataset.ri], false); }
    else if (t.classList.contains("adv-rec-applyg")) { applyRec(recOptions[+t.dataset.ri], true); }
  });

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
  const engravingSkillNames = {
    fluorescence_burst: "형광 폭발",
    crystal_absorb: "마력 흡수",
    amber_stun: "고대의 속박",
  };
  const statusNames = {
    confusion: "혼란", stealth: "은신", burn: "화상", regen: "재생", mp_regen: "MP 재생",
    evasion: "회피", atk_buff: "ATK", def_buff: "DEF", taunt: "도발", mp_cost_reduce: "마나 절약",
    poison: "중독", stun: "스턴", sleep: "수면", heal_block: "회복 불가", cc_immune: "CC 면역",
    undying: "불사", afterimage: "잔상", frozen: "빙결", blind: "실명", splash: "공명",
    damage_reflect: "반사", dmg_cap: "피해 상한", def_pierce: "관통", anti_magic: "항마",
  };

  const renderCombatFlow = (sample) => {
    const stateValue = (value) => {
      const safe = Math.max(0, Number(value) || 0);
      return safe > 0 && safe < 1 ? "&lt;1" : Math.round(safe).toLocaleString("ko-KR");
    };
    const start = sample.events.find((event) => event.type === "battle_start");
    const initialUnits = start?.snapshots || [];
    const unitById = new Map(initialUnits.map((unit) => [unit.unitId, unit]));
    const allyIds = new Set((start?.allies || []).map((unit) => unit.id || unit.unitId));
    if (!allyIds.size) initialUnits.slice(0, party.length).forEach((unit) => allyIds.add(unit.unitId));
    const allyOrder = initialUnits.filter((unit) => allyIds.has(unit.unitId)).map((unit) => unit.unitId);
    const enemyOrder = initialUnits.filter((unit) => !allyIds.has(unit.unitId)).map((unit) => unit.unitId);
    const isAlly = (unitId) => allyIds.has(unitId);
    const engravingIds = new Set(Object.keys(engravingSkillNames));

    const statsFor = (events) => {
      const stats = { dealt: 0, taken: 0, healed: 0, potions: 0, engravings: 0, kills: 0, losses: 0 };
      events.forEach((event) => {
        if (event.type === "potion_use") stats.potions++;
        if (engravingIds.has(event.skillId)) stats.engravings++;
        if (event.type === "defeat") {
          if (isAlly(event.unitId)) stats.losses++;
          else stats.kills++;
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
        changes.push(`<span class="adv-change ${tone}"><span>${esc(unit?.name || change.unitId)}</span><b>${sign}${Math.round(Math.abs(change.delta))} ${stat}</b>${remaining}</span>`);
      };
      (event.hpChanges || []).forEach((change) => addChange(change, "HP"));
      (event.mpChanges || []).forEach((change) => addChange(change, "MP"));
      return changes.join("");
    };

    const actionName = (event, actor) => {
      if (event.type === "potion_use") return nm(event.itemCode);
      if (event.type === "defeat") return "전투 불능";
      if (event.type === "status_effect") return "상태 효과";
      if (event.type === "crystal_divination") return "수정 점술";
      if (engravingSkillNames[event.skillId]) return engravingSkillNames[event.skillId];
      return actor?.skills?.find((skill) => skill.id === event.skillId)?.name || "행동";
    };

    const eventMarkup = (event) => {
      const eventUnitId = event.actorId || event.unitId || event.hpChanges?.[0]?.unitId || event.mpChanges?.[0]?.unitId;
      const actor = unitById.get(eventUnitId);
      const side = actor ? (isAlly(eventUnitId) ? "ally" : "enemy") : "system";
      const engraving = engravingIds.has(event.skillId);
      const text = event.text || (event.type === "defeat" ? `${event.unitName || actor?.name || "대상"} 전투 불능` : "상태 변경");
      const icon = actor
        ? `<span class="adv-event-unit" data-battle-unit="${esc(eventUnitId)}"></span>`
        : `<span class="adv-event-unit system">·</span>`;
      return `<div class="adv-event ${side}${engraving ? " engraving" : ""}${event.type === "defeat" ? " defeat" : ""}">
        ${icon}
        <div class="adv-event-main">
          <div class="adv-event-head"><b>${esc(actor?.name || event.unitName || "전투")}</b><span>${esc(actionName(event, actor))}</span></div>
          <div class="adv-event-text">${esc(text)}</div>
          <div class="adv-event-changes">${changeMarkup(event)}</div>
        </div>
      </div>`;
    };

    const teamMarkup = (ids, label, side, snapshotMap) => {
      const units = ids.map((id) => snapshotMap.get(id) || unitById.get(id)).filter(Boolean);
      const alive = units.filter((unit) => unit.hp > 0).length;
      return `<div class="adv-state-team ${side}">
        <div class="adv-state-title"><b>${label}</b><span>${alive}/${units.length}</span></div>
        ${units.map((unit) => {
          const hp = Math.max(0, unit.hp || 0);
          const maxHp = Math.max(1, unit.maxHp || 1);
          const mp = Math.max(0, unit.mp || 0);
          const maxMp = Math.max(0, unit.maxMp || 0);
          const hpPct = clamp(hp / maxHp * 100, 0, 100);
          const mpPct = maxMp ? clamp(mp / maxMp * 100, 0, 100) : 0;
          const critical = hp > 0 && hp < 1;
          const statuses = (unit.statusEffects || []).filter((status) => status.turnsLeft !== 0).slice(0, 4)
            .map((status) => `<span class="adv-status" title="${esc(status.type)}">${esc(statusNames[status.type] || status.type)}${status.turnsLeft != null ? ` ${status.turnsLeft}T` : ""}</span>`).join("");
          return `<div class="adv-state-unit${hp <= 0 ? " dead" : ""}${critical ? " critical" : ""}" style="--hp:${hpPct.toFixed(1)}%;--mp:${mpPct.toFixed(1)}%">
            <span class="adv-state-icon" data-battle-unit="${esc(unit.unitId)}"></span>
            <b class="adv-state-name">${esc(unit.name)}</b>
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
      turns.push(`<details class="adv-turn"${open ? " open" : ""}>
        <summary>
          <b>${turn}턴</b>
          <span class="adv-turn-metric dealt">가한 피해 ${stats.dealt.toLocaleString("ko-KR")}</span>
          <span class="adv-turn-metric taken">받은 피해 ${stats.taken.toLocaleString("ko-KR")}</span>
          ${stats.kills ? `<span class="adv-turn-metric kills">처치 ${stats.kills}</span>` : ""}
          ${stats.engravings ? `<span class="adv-turn-metric engraving">세공 ${stats.engravings}</span>` : ""}
          <span class="adv-turn-time">누적 ${fmtSec(advSec(turn))}</span>
        </summary>
        <div class="adv-turn-content">
          <div class="adv-events">${group.events.length ? group.events.map(eventMarkup).join("") : `<div class="adv-event-empty">행동 없음</div>`}</div>
          <div class="adv-turn-state">${teamMarkup(allyOrder, "아군", "ally", snapshotMap)}${teamMarkup(enemyOrder, "적", "enemy", snapshotMap)}</div>
        </div>
      </details>`);
    }

    const totals = statsFor(sample.events);
    const engravingCounts = Object.entries(engravingSkillNames).map(([skillId, label]) => ({
      label,
      count: sample.events.filter((event) => event.skillId === skillId).length,
    })).filter(({ count }) => count > 0);
    const engravingText = engravingCounts.length
      ? engravingCounts.map(({ label, count }) => `${label} ${count}회`).join(" · ")
      : "발동 없음";
    const actionCount = sample.events.filter((event) => event.text).length;

    return {
      allyIds,
      unitById,
      markup: `<section class="adv-combat-flow">
        <div class="adv-flow-head"><b>대표 전투 흐름</b><span>${actionCount}개 행동</span></div>
        <div class="adv-combat-stats">
          <span><small>가한 피해</small><b>${totals.dealt.toLocaleString("ko-KR")}</b></span>
          <span><small>받은 피해</small><b>${totals.taken.toLocaleString("ko-KR")}</b></span>
          <span><small>회복</small><b>${totals.healed.toLocaleString("ko-KR")}</b></span>
          <span><small>포션 사용</small><b>${totals.potions}회</b></span>
          <span><small>세공 발동</small><b>${totals.engravings}회</b></span>
        </div>
        <div class="adv-engraving-summary"><span>세공</span><b>${esc(engravingText)}</b></div>
        <div class="adv-turn-list">${turns.join("")}</div>
      </section>`,
    };
  };

  const hydrateCombatIcons = ({ allyIds, unitById }) => {
    q("#adv-result").querySelectorAll("[data-battle-unit]").forEach((element) => {
      const unit = unitById.get(element.dataset.battleUnit);
      if (!unit?.spriteKey) return;
      if (allyIds.has(unit.unitId)) advIcon(element, unit.spriteKey, "adv-battle-img");
      else monsterIcon(element, unit.spriteKey, "adv-battle-img");
    });
  };

  function run() {
    const partyObj = {
      adventurers: party.map((p) => ({
        id: p.id,
        equip: p.equip || undefined,
        equipEnh: p.equipEnh,
        engraved: p.equip
          ? (p.engraved || []).filter((slot) => slot && gemSet.has(slot.itemCode)).map((slot) => ({
            itemCode: slot.itemCode,
            enhancement: clamp(slot.enhancement, 0, 20),
          }))
          : [],
      })),
      potions: pots.map((p) => ({ code: p.code, enh: p.enh })),
      skills: {},
      difficulty: nightmare,
    };
    let wr, sample;
    try {
      wr = winRate(partyObj, zoneId, g, 200);
      sample = simulate(partyObj, zoneId, g, 20260606);   // 대표 1회 (로그)
    } catch (err) { q("#adv-result").innerHTML = `<div class="err-box">시뮬 오류: ${err.message}</div>`; return; }
    const pct = (wr.rate * 100).toFixed(1);
    const cls = wr.rate >= 0.8 ? "good" : wr.rate >= 0.4 ? "mid" : "bad";
    const logRows = sample.events.filter((event) => event.text)
      .map((event) => `<div class="adv-log-r"><span class="adv-log-t">${event.turn}T</span> ${esc(event.text)}</div>`).join("");
    const winAvg = wr.avgTurnsOnWin ? `${wr.avgTurnsOnWin.toFixed(1)}턴 (≈${fmtSec(advSec(wr.avgTurnsOnWin))})` : "-";
    const lossInfo = wr.losses > 0
      ? ` · 패배 ${wr.losses}/${wr.trials} · 패배 시 평균 ${wr.avgTurnsOnLoss.toFixed(1)}턴 (≈${fmtSec(advSec(wr.avgTurnsOnLoss))})`
      : " · 패배 없음";
    const turnDist = Object.entries(wr.winTurnCounts || {}).sort((a, b) => +a[0] - +b[0]);
    const turnDistMarkup = turnDist.length ? `<div class="adv-turn-dist">
      <b>승리 턴 분포</b>
      <div>${turnDist.map(([turn, count]) => `<span><b>${turn}턴</b><small>${fmtSec(advSec(+turn))} · ${(count / wr.wins * 100).toFixed(1)}%</small></span>`).join("")}</div>
    </div>` : "";
    const combatFlow = renderCombatFlow(sample);
    q("#adv-result").innerHTML = `
      <div class="adv-wr ${cls}">
        <div class="adv-wr-pct">${pct}%</div>
        <div class="adv-wr-sub">${nightmare > 0 ? `악몽 ${nightmare}단계 · ` : ""}가상 시드 승률 (${wr.wins}/${wr.trials}) · 승리 시 평균 ${winAvg}${lossInfo}</div>
      </div>
      ${turnDistMarkup}
      <div class="adv-sample ${sample.victory ? "win" : "lose"}">대표 전투: ${sample.victory ? "⚔️ 승리" : "💀 패배"} (${sample.totalTurns}턴 · ⏱️ ${fmtSec(advSec(sample.totalTurns))})</div>
      ${combatFlow.markup}
      <details class="adv-logbox"><summary>원문 로그 (${sample.events.filter((event) => event.text).length}줄)</summary>
        <div class="adv-log">${logRows}</div></details>`;
    hydrateCombatIcons(combatFlow);
  }

  renderParty(); renderPots(); renderEnemies();
}
