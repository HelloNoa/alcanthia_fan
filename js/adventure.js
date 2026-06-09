// ⚔️ 모험 전투 시뮬레이터 (계산기 서브탭)
import { gamedata } from "./api.js";
import { itemIcon, monsterIcon, CDN } from "./sprites.js";
import { simulate, winRate } from "./battle.js";

function advIcon(el, spriteKey) {
  const img = document.createElement("img");
  img.loading = "lazy"; img.className = "ic";
  img.onerror = () => img.remove();
  img.src = `${CDN}/npc/${spriteKey}.png`;
  el.appendChild(img);
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
  // 모험 소요 시간 = (턴수+1) × 6초 (La=6000ms)
  const advSec = (turns) => (turns + 1) * 6;
  const fmtSec = (s) => { s = Math.round(s); const m = Math.floor(s / 60); return m ? `${m}분 ${s % 60}초` : `${s}초`; };

  // 상태: 파티 / 포션 / 존 (기본 4명, 최대 4)
  let party = advs.slice(0, 4).map(([id]) => ({ id, equip: "", equipEnh: 0 }));
  let pots = [];
  let zoneId = zones[0][0];

  const advOpts = (sel) => advs.map(([id, a]) =>
    `<option value="${id}"${id === sel ? " selected" : ""}>${a.name} · ${a.title} (${a.type === "dealer" ? "딜" : a.type === "tank" ? "탱" : a.type === "healer" ? "힐" : a.type}·★${a.grade})</option>`).join("");
  const equipOpts = (sel) => `<option value="">장비 없음</option>` + equips.map((c) => {
    const s = g.equipment_stats[c];
    return `<option value="${c}"${c === sel ? " selected" : ""}>${nm(c)} (${["atk", "def", "hp", "mp"].filter(k => s[k]).map(k => `${k.toUpperCase()}${s[k]}`).join("/")})</option>`;
  }).join("");
  const potOpts = (sel) => potions.map((c) =>
    `<option value="${c}"${c === sel ? " selected" : ""}>${nm(c)}</option>`).join("");
  const zoneOpts = () => zones.map(([id, z]) =>
    `<option value="${id}"${id === zoneId ? " selected" : ""}>${z.name} (${(z.monsters || []).length}마리, ${z.rule === "enemy_first" ? "적 선공" : "아군 선공"})</option>`).join("");
  // 전투 세공 3종 (배틀엔진이 코드로 직접 처리)
  const GEMS = [
    { code: "refined_amber", label: "호박석 (공격시 스턴)" },
    { code: "refined_fluorite", label: "형석 (피격누적 반격)" },
    { code: "refined_crystal", label: "수정 (피격시 MP환원)" },
  ];
  const gemOpts = (sel) => `<option value="">세공 없음</option>` + GEMS.map((gm) =>
    `<option value="${gm.code}"${gm.code === sel ? " selected" : ""}>${gm.label}</option>`).join("");

  body.innerHTML = `
    <div class="adv-sim">
      <h3>⚔️ 모험 전투 시뮬레이터 <span class="muted">(게임 전투 로직 충실 재현)</span></h3>
      <div class="adv-sec"><div class="adv-sec-h">🧑‍🤝‍🧑 출정 모험가 <span class="muted">(장비·강화)</span></div>
        <div id="adv-party"></div>
        <button id="adv-addp" class="adv-add">+ 모험가</button></div>
      <div class="adv-sec"><div class="adv-sec-h">🧪 휴대 포션 <span class="muted">(전투 중 자동 사용)</span></div>
        <div id="adv-pots"></div>
        <button id="adv-addpot" class="adv-add">+ 포션</button></div>
      <div class="adv-sec"><div class="adv-sec-h">🗺️ 모험 지역</div>
        <div class="adv-zone-row"><select id="adv-zone" class="num-in">${zoneOpts()}</select>
          <button id="adv-rec" class="adv-rec">🎯 이 지역 추천 파티</button></div>
        <div id="adv-recnote"></div>
        <div id="adv-enemies" class="adv-enemies"></div></div>
      <button id="adv-run" class="adv-run">⚔️ 출정 (200회 시뮬)</button>
      <div id="adv-result"></div>
      <div class="calc-note">💡 데미지 = max(1, ATK×스킬계수×100/(100+DEF)) · 최대 30턴 · 적 전멸 시 승리.
        스마트 유닛(아군)은 우선순위로 스킬 선택, 멍청한 몬스터는 랜덤. 시드 결정론적이라 200회 다른 시드로 돌려 승률을 냅니다.</div>
    </div>`;

  const q = (s) => body.querySelector(s);

  const renderParty = () => {
    const el = q("#adv-party"); el.innerHTML = "";
    party.forEach((p, i) => {
      const row = document.createElement("div"); row.className = "adv-row";
      row.innerHTML = `
        <span class="adv-port" data-sp="${g.adventurers[p.id]?.spriteKey || ""}"></span>
        <select class="adv-pick" data-i="${i}" data-f="id">${advOpts(p.id)}</select>
        <select class="adv-pick adv-eq" data-i="${i}" data-f="equip">${equipOpts(p.equip)}</select>
        <label class="adv-enh">+<input type="number" min="0" max="99" value="${p.equipEnh}" data-i="${i}" data-f="equipEnh" class="adv-enh-in"></label>
        <select class="adv-pick adv-gem" data-i="${i}" data-f="gem">${gemOpts(p.gem)}</select>
        <label class="adv-enh">+<input type="number" min="0" max="20" value="${p.gemEnh || 0}" data-i="${i}" data-f="gemEnh" class="adv-enh-in" title="세공 강화도"></label>
        <button class="adv-x" data-i="${i}" data-t="p">✕</button>`;
      el.appendChild(row);
      advIcon(row.querySelector(".adv-port"), g.adventurers[p.id]?.spriteKey || "");
    });
    q("#adv-addp").style.display = party.length >= 4 ? "none" : "";
  };
  const renderPots = () => {
    const el = q("#adv-pots"); el.innerHTML = "";
    if (!pots.length) { el.innerHTML = `<div class="muted" style="font-size:13px">포션 없음</div>`; return; }
    pots.forEach((p, i) => {
      const row = document.createElement("div"); row.className = "adv-row";
      row.innerHTML = `
        <span class="adv-pic" data-ic="${p.code}"></span>
        <select class="adv-pick" data-i="${i}" data-f="code" data-t="pot">${potOpts(p.code)}</select>
        <label class="adv-enh">+<input type="number" min="0" max="40" value="${p.enh}" data-i="${i}" data-f="enh" data-t="pot" class="adv-enh-in"></label>
        <button class="adv-x" data-i="${i}" data-t="pot">✕</button>`;
      el.appendChild(row);
      itemIcon(row.querySelector(".adv-pic"), p.code);
    });
    q("#adv-addpot").style.display = pots.length >= 4 ? "none" : "";
  };
  const renderEnemies = () => {
    const el = q("#adv-enemies"); el.innerHTML = "";
    const z = g.zones[zoneId];
    (z.monsters || []).forEach((mid) => {
      const m = g.monsters[mid]; if (!m) return;
      const c = document.createElement("span"); c.className = "adv-enemy";
      c.innerHTML = `<span class="adv-mic" data-sp="${m.spriteKey}"></span><span class="adv-mn">${m.name}</span><span class="adv-ms">HP${m.hp} ATK${m.atk} DEF${m.def}</span>`;
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
    const wrOf = (arr) => winRate({ adventurers: ids.map((id, j) => ({ id, equip: arr[j], equipEnh: enh })), potions: [], skills: {} }, zid, g, 35).rate;
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
    const mkp = (e, pots) => ({ adventurers: ids.map((id, j) => ({ id, equip: eq[j], equipEnh: e })), potions: pots, skills: {} });
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
        const r = winRate({ adventurers: ids.map((id) => ({ id, equip: eqOf(id), equipEnh: e })), potions: [], skills: {} }, zid, g, 30);
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
      const mk = (eq, e) => ({ adventurers: ids.map((id, j) => ({ id, equip: eq[j], equipEnh: e })), potions: [], skills: {} });
      let e0 = null;
      for (let e = 0; e <= MAXE; e++) { if (winRate(mk(baseEq, e), zid, g, 40).rate >= 0.85) { e0 = e; break; } }
      const eq = optimizeEquip(ids, zid, e0 != null ? e0 : MAXE, a.pool);
      // 포션을 "12초 강화도 우선, 다음 클리어 강화도" 최소화로 선택 (강화보다 양조가 쉬움)
      const { pots, clearE: rawClear, fastE: rawFast } = optimizePotions(ids, eq, zid);
      const clearE = rawClear != null && rawClear <= MAXE ? rawClear : null;
      const fastE = rawFast != null && rawFast <= MAXE ? rawFast : null;
      const mkp = (e) => ({ adventurers: ids.map((id, j) => ({ id, equip: eq[j], equipEnh: e })), potions: pots, skills: {} });
      const conf = clearE != null ? winRate(mkp(clearE), zid, g, 200) : null;
      // 세공(호박석 스턴) 포함 버전 — 장비·세공 동일 강화도로 묶어 최소 강화도 탐색
      const mkg = (e) => ({ adventurers: ids.map((id, j) => ({ id, equip: eq[j], equipEnh: e, engraved: [{ itemCode: "refined_amber", enhancement: e }] })), potions: pots, skills: {} });
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
    party = o.ids.map((id, j) => ({ id, equip: o.equip[j], equipEnh: e, ...(gem ? { gem: "refined_amber", gemEnh: e } : {}) }));
    pots = (o.potions || []).map((p) => ({ code: p.code, enh: p.enh }));
    renderParty(); renderPots();
  };

  // 입력 바인딩 (위임)
  body.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "adv-zone") { zoneId = t.value; renderEnemies(); return; }
    const i = +t.dataset.i;
    if (t.dataset.t === "pot") { pots[i][t.dataset.f] = t.dataset.f === "enh" ? Math.max(0, +t.value || 0) : t.value; renderPots(); }
    else if (t.dataset.f) { const num = t.dataset.f === "equipEnh" || t.dataset.f === "gemEnh"; party[i][t.dataset.f] = num ? Math.max(0, +t.value || 0) : t.value; if (t.dataset.f === "id") renderParty(); }
  });
  body.addEventListener("click", (e) => {
    const t = e.target;
    if (t.id === "adv-addp") { if (party.length < 4) { party.push({ id: advs[0][0], equip: "", equipEnh: 0 }); renderParty(); } }
    else if (t.id === "adv-addpot") { if (pots.length < 4) { pots.push({ code: potions[0], enh: 0 }); renderPots(); } }
    else if (t.classList.contains("adv-x")) {
      const i = +t.dataset.i;
      if (t.dataset.t === "pot") { pots.splice(i, 1); renderPots(); }
      else if (party.length > 1) { party.splice(i, 1); renderParty(); }
    }
    else if (t.id === "adv-run") run();
    else if (t.id === "adv-rec") {
      q("#adv-recnote").innerHTML = `<div class="adv-rec-r calc">🎯 추천 파티 계산 중… <span class="muted">(잠시만요)</span></div>`;
      setTimeout(() => {
        recOptions = recommendAll(zoneId);
        q("#adv-recnote").innerHTML = `<div class="adv-rec-h">🎯 진행도별 추천 <span class="muted">(편성·장비·포션 시뮬 최적 · ★4=다이아, ★5=존12 해금)</span></div>
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

  function run() {
    const partyObj = {
      adventurers: party.map((p) => ({ id: p.id, equip: p.equip || undefined, equipEnh: p.equipEnh, engraved: p.gem ? [{ itemCode: p.gem, enhancement: p.gemEnh || 0 }] : [] })),
      potions: pots.map((p) => ({ code: p.code, enh: p.enh })),
      skills: {},
    };
    let wr, sample;
    try {
      wr = winRate(partyObj, zoneId, g, 200);
      sample = simulate(partyObj, zoneId, g, 20260606);   // 대표 1회 (로그)
    } catch (err) { q("#adv-result").innerHTML = `<div class="err-box">시뮬 오류: ${err.message}</div>`; return; }
    const pct = (wr.rate * 100).toFixed(1);
    const cls = wr.rate >= 0.8 ? "good" : wr.rate >= 0.4 ? "mid" : "bad";
    const logRows = sample.events.filter((e) => e.text).map((e) => {
      const cl = /승리|회복|\+/.test(e.text) ? "log-ally" : /패배|쓰러|사망/.test(e.text) ? "log-bad" : "";
      return `<div class="adv-log-r ${cl}"><span class="adv-log-t">${e.turn}T</span> ${e.text}</div>`;
    }).join("");
    q("#adv-result").innerHTML = `
      <div class="adv-wr ${cls}">
        <div class="adv-wr-pct">${pct}%</div>
        <div class="adv-wr-sub">승률 (${wr.wins}/${wr.trials}) · 승리 시 평균 ${wr.avgTurnsOnWin ? `${wr.avgTurnsOnWin.toFixed(1)}턴 (≈${fmtSec(advSec(wr.avgTurnsOnWin))})` : "-"}</div>
      </div>
      <div class="adv-sample ${sample.victory ? "win" : "lose"}">대표 전투: ${sample.victory ? "⚔️ 승리" : "💀 패배"} (${sample.totalTurns}턴 · ⏱️ ${fmtSec(advSec(sample.totalTurns))})</div>
      <details class="adv-logbox"><summary>전투 로그 (${sample.events.filter((e) => e.text).length}줄)</summary>
        <div class="adv-log">${logRows}</div></details>`;
  }

  renderParty(); renderPots(); renderEnemies();
}
