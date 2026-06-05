import { gamedata, names } from "./api.js";
import { itemIcon, plantIcon, skillIcon, monsterIcon, fmtDuration } from "./sprites.js";

const fmt = (n) => (n == null ? "-" : Number(n).toLocaleString());
// 개발 테스트용 작물 (시험용 / aging_)
export const isTestPlant = (id, name) => /^aging_/.test(id) || (name || "").includes("시험용");

export async function renderCodex(view) {
  const g = await gamedata();
  const N = await names();
  const CATS = [
    { key: "plants", label: "🌱 작물" },
    { key: "potions", label: "🧪 포션" },
    { key: "skills", label: "🔮 스킬" },
    { key: "monsters", label: "🐺 몬스터" },
    { key: "items", label: "📦 아이템" },
    { key: "transmute", label: "🔀 변성" },
  ];
  view.innerHTML = `<h2>📖 도감</h2>
    <nav class="subtabs" id="cxcats">${CATS.map((c, i) =>
      `<button data-k="${c.key}" class="${i === 0 ? "active" : ""}">${c.label}</button>`).join("")}</nav>
    <input id="cxq" class="filter-input" placeholder="이름 검색…">
    <div id="cxbody"></div>`;

  const body = view.querySelector("#cxbody");
  const qInput = view.querySelector("#cxq");
  let cur = "plants";

  // 역인덱스
  const brewByOut = {};
  for (const r of g.brew_recipes || []) brewByOut[r.output] = r.inputs;
  const craftByOut = {};
  for (const r of g.recipes_full || []) if (r.type !== "brew") craftByOut[r.output] = r;
  const monsterZones = {};
  for (const z of Object.values(g.zones || {})) for (const m of (z.monsters || [])) (monsterZones[m] ??= []).push(z.name);
  const TARGET = { self: "자신", enemy_one: "적 단일", enemy_all: "적 전체", ally_one: "아군", ally_all: "아군 전체" };

  // 테스트/미사용 아이템 (도감 제외)
  const testSet = new Set(g.test_items || []);
  const isTest = (code, it) => testSet.has(code) || (it?.name || "").includes("시험용");

  // 포션 강화(e) 효과 평가 — 게임 헬퍼 그대로 (wn=e+1, gi=⌊(e+2)/2⌋, Jt=4(e+1), YP=4^e, Oh=e×2, uy=25)
  const PHF = { wn: (e) => e + 1, ku: (e) => e + 1, gi: (e) => Math.floor((e + 2) / 2), Jt: (e) => 4 * (e + 1), YP: (e) => 4 ** e, Oh: (e) => e * 2, uy: () => 25 };
  const evalExpr = (x, e) => {
    try {
      const v = new Function("e", "Math", "wn", "ku", "gi", "Jt", "YP", "Oh", "uy", "return (" + x + ")")(e, Math, PHF.wn, PHF.ku, PHF.gi, PHF.Jt, PHF.YP, PHF.Oh, PHF.uy);
      return typeof v === "number" ? (Number.isInteger(v) ? v : +v.toFixed(2)) : String(v);
    } catch { return "?"; }
  };
  // ${...} 치환 (중첩 중괄호 허용: uy({}) 등)
  const evalEff = (tpl, e) => {
    let out = "", i = 0;
    while (i < tpl.length) {
      const st = tpl.indexOf("${", i);
      if (st < 0) { out += tpl.slice(i); break; }
      out += tpl.slice(i, st);
      let depth = 0, j = st + 2;
      for (; j < tpl.length; j++) {
        if (tpl[j] === "{") depth++;
        else if (tpl[j] === "}") { if (depth === 0) break; depth--; }
      }
      out += evalExpr(tpl.slice(st + 2, j), e);
      i = j + 1;
    }
    return out;
  };
  // 강화 의존 = 강화도 바꿨을 때 결과가 달라짐
  const isEnhDep = (f) => !!f && f.includes("${") && evalEff(f, 0) !== evalEff(f, 5);

  // 획득 출처 (양조/제작/수확/전리품/상점)
  const shopSet = new Set(g.shop_items || []);
  const zoneList = Object.entries(g.zones || {});  // 레벨 순서 = 인덱스+1
  const plantByProduce = {};
  for (const [pid, p] of Object.entries(g.plants || {})) {
    if (isTestPlant(pid, p.name)) continue;  // 시험용 작물 제외
    for (const pr of (p.produces || [])) {
      if (pr.itemCode) plantByProduce[pr.itemCode] = p.name;
      if (pr.ripen?.itemCode) plantByProduce[pr.ripen.itemCode] = p.name;  // 숙성 수확물 (노을열매 등)
    }
  }
  const sourceRow = (card, code) => {
    const src = [];
    if (brewByOut[code]) src.push("⚗️ 양조");
    if (craftByOut[code]) src.push("🔨 제작");
    if (plantByProduce[code]) src.push(`🌾 수확 (${plantByProduce[code]})`);
    const zs = [];
    zoneList.forEach(([, z], i) => { if (z.drops && z.drops[code]) zs.push(`Lv${i + 1} ${z.name}`); });
    if (zs.length) src.push(`⚔️ 전리품 (${zs.join(", ")})`);
    if (shopSet.has(code)) src.push("🏪 상점");
    const dia = g.dia_shop?.[code];
    if (dia) src.push(`💎 다이아 상점 (${dia.dia}다이아${dia.lv ? `, Lv${dia.lv}` : ""})`);
    if (code.startsWith("dia_box_")) src.push("💵 과금 (현금 구매) · 🛒 시장 거래");
    if (g.special_source?.[code]) src.push(g.special_source[code]);
    if (!src.length && (g.unobtainable || []).includes(code)) src.push("🚫 획득 불가");
    if (src.length) card.insertAdjacentHTML("beforeend", `<div class="cx-source"><b>획득</b> ${src.join(" · ")}</div>`);
  };

  // 재료 아이콘 줄
  const ingRow = (card, label, codes) => {
    const row = document.createElement("div");
    row.className = "cx-ings";
    row.insertAdjacentHTML("beforeend", `<span class="cx-ings-label">${label}</span>`);
    codes.forEach((c, i) => {
      if (i) row.insertAdjacentHTML("beforeend", `<span class="plus">+</span>`);
      const ic = document.createElement("span"); ic.className = "cx-iic"; itemIcon(ic, c);
      row.appendChild(ic);
      row.insertAdjacentHTML("beforeend", `<span>${N.items?.[c] || c}</span>`);
    });
    card.appendChild(row);
  };

  const render = (key, q = "") => {
    q = q.trim();
    const match = (name) => !q || (name || "").includes(q);
    body.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "cx-grid";

    if (key === "plants") {
      Object.entries(g.plants || {}).forEach(([id, p]) => {
        if (isTestPlant(id, p.name) || !match(p.name)) return;
        const prod = (p.produces || [])[0];
        const rows = [
          ["성장", fmtDuration(p.growTime_ms)],
          ["수명", p.oneShot ? "1회성" : (p.maxHarvests == null ? "무한" : `${fmt(p.maxHarvests)}회`)],
        ];
        if (prod) {
          rows.push(["생산주기", prod.interval_ms ? fmtDuration(prod.interval_ms) : "—"]);
          if (prod.max > 1) rows.push(["회당", `${prod.max}개`]);
        }
        const card = cxCard((ic) => plantIcon(ic, p.spriteKey || id), p.name, rows);
        if (prod) {
          const pe = document.createElement("div");
          pe.className = "cx-produce";
          const ic = document.createElement("span"); ic.className = "cx-pic"; itemIcon(ic, prod.itemCode);
          pe.appendChild(ic);
          pe.insertAdjacentHTML("beforeend", `<span>${N.items?.[prod.itemCode] || prod.itemCode}</span>`);
          if (prod.ripen) {
            pe.insertAdjacentHTML("beforeend", `<span class="ripen-arrow">숙성→</span>`);
            const ic2 = document.createElement("span"); ic2.className = "cx-pic"; itemIcon(ic2, prod.ripen.itemCode);
            pe.appendChild(ic2);
            pe.insertAdjacentHTML("beforeend", `<span>${N.items?.[prod.ripen.itemCode] || prod.ripen.itemCode}</span>`);
          }
          card.appendChild(pe);
        }
        if (p.perk) {
          card.insertAdjacentHTML("beforeend", `<div class="cx-perk">✨ ${p.perk}</div>`);
        }
        grid.appendChild(card);
      });
    } else if (key === "potions") {
      Object.entries(g.items || {}).filter(([, it]) => it.type === "potion").forEach(([code, it]) => {
        if (!match(it.name) || isTest(code, it)) return;
        const combat = g.potion_effects?.[code];
        const use = g.potion_use_effects?.[code];
        const useF = use?.formula, combatF = combat?.formula;
        const hasDur = (g.use_duration || []).includes(code);  // 지속형 사용효과 (10×2^강화 분)
        const durTxt = (e) => `${10 * 2 ** e}분`;
        const enhDep = isEnhDep(useF) || isEnhDep(combatF) || hasDur;
        const txt = (e) => e && (e.base || fmtFormula(e.formula));
        const trans = g.transmute_effects?.[code];
        const rows = [["양조", fmtDuration(it.brewDuration_ms)]];
        // 강화 비의존이면 정적으로 행에 표시
        if (!enhDep) {
          if (txt(use)) rows.push(["🧪 사용", txt(use)]);
          if (txt(combat)) {
            const tgt = combat.targets?.map((t) => TARGET[t] || t).join(", ");
            const showTgt = tgt && !/자신|아군|적/.test(txt(combat));
            rows.push(["⚔️ 전투", txt(combat) + (showTgt ? ` (${tgt})` : "")]);
          }
          if (!txt(use) && !txt(combat) && !trans) rows.push(["효과", "—"]);
        }
        const card = cxCard((ic) => itemIcon(ic, code), it.name, rows);
        if (brewByOut[code]) ingRow(card, "재료", brewByOut[code]);
        // 강화 의존: +/- 로 효과 갱신
        if (enhDep) {
          let enhP = 0;
          const effLine = (k, f, base, combatObj) => {
            const v = isEnhDep(f) ? evalEff(f, enhP) : (f ? fmtFormula(f) : base);
            let s = v;
            if (combatObj) {
              const tgt = combatObj.targets?.map((t) => TARGET[t] || t).join(", ");
              if (tgt && !/자신|아군|적/.test(String(v))) s = `${v} (${tgt})`;
            }
            return `<div><span>${k}</span><b>${s}</b></div>`;
          };
          const block = document.createElement("div");
          block.innerHTML = `<div class="cx-enh-ctrl"><span class="cx-enh-lbl">강화</span>
            <button class="cx-enh-btn" data-d="-1">−</button><b class="cx-enh-lv">+0</b>
            <button class="cx-enh-btn" data-d="1">+</button></div><div class="cx-rows cx-eff-rows"></div>`;
          const rowsEl = block.querySelector(".cx-eff-rows"), lvEl = block.querySelector(".cx-enh-lv");
          const upd = () => {
            lvEl.textContent = `+${enhP}`;
            const out = [];
            if (useF || use?.base || hasDur) {
              let v = isEnhDep(useF) ? evalEff(useF, enhP) : (useF ? fmtFormula(useF) : (use?.base || ""));
              if (hasDur) v += ` <i class="cx-dur">⏱ ${durTxt(enhP)}</i>`;
              out.push(`<div><span>🧪 사용</span><b>${v}</b></div>`);
            }
            if (combatF || combat?.base) out.push(effLine("⚔️ 전투", combatF, combat?.base, combat));
            rowsEl.innerHTML = out.join("");
          };
          block.querySelectorAll(".cx-enh-btn").forEach((b) => b.onclick = () => { enhP = Math.max(0, enhP + (+b.dataset.d)); upd(); });
          upd();
          card.appendChild(block);
        }
        sourceRow(card, code);
        if (trans) card.insertAdjacentHTML("beforeend", `<div class="cx-perk">🔀 변성 · ${trans}</div>`);
        grid.appendChild(card);
      });
    } else if (key === "skills") {
      const treeKr = { farming: "재배", brewing: "연성", mana: "마나", contract: "계약", harvest: "수확", growth: "성장", crafting: "제작" };
      Object.entries(g.skills || {}).forEach(([id, sk]) => {
        if (!match(sk.name)) return;
        const card = cxCard((ic) => skillIcon(ic, id), `${sk.name} <small>(${treeKr[sk.treeId] || sk.treeId})</small>`, [
          ["최대Lv", sk.maxLevel],
          ["효과", fmtFormula(sk.formula || sk.description)],
        ]);
        const pre = (sk.prereqs || []).filter((p) => g.skills?.[p.id]);
        if (pre.length) card.insertAdjacentHTML("beforeend",
          `<div class="cx-sub">선행: ${pre.map((p) => `${g.skills[p.id].name} Lv${p.level}`).join(", ")}</div>`);
        if (sk.flavor) card.insertAdjacentHTML("beforeend", `<div class="cx-flavor">“${sk.flavor}”</div>`);
        grid.appendChild(card);
      });
    } else if (key === "monsters") {
      const zoneOrder = Object.keys(g.zones || {});
      const zoneIdx = {};
      zoneOrder.forEach((zid, i) => {
        for (const mid of (g.zones[zid].monsters || [])) if (!(mid in zoneIdx)) zoneIdx[mid] = i;
      });
      // 존별 그룹화
      const groups = zoneOrder.map(() => []);
      const other = [];
      Object.values(g.monsters || {}).forEach((m) => {
        if (!match(m.name)) return;
        const idx = zoneIdx[m.id];
        (idx == null ? other : groups[idx]).push(m);
      });
      const monCard = (m) => {
        const card = cxCard((ic) => monsterIcon(ic, m.spriteKey), `${m.name}${m.boss ? " 👑" : ""}`, [
          ["HP", fmt(m.hp)], ["ATK", fmt(m.atk)], ["DEF", fmt(m.def)], ["MP", fmt(m.mp)],
        ]);
        (m.skills || []).forEach((sk) => {
          const meta = [];
          if (sk.coef != null) meta.push(`계수 ${sk.coef}`);
          if (sk.cd) meta.push(`쿨 ${sk.cd}`);
          if (sk.mp) meta.push(`MP ${sk.mp}`);
          card.insertAdjacentHTML("beforeend",
            `<div class="mon-skill"><b>${sk.name}</b> ${sk.desc}${meta.length ? ` <span class="sk-meta">${meta.join(" · ")}</span>` : ""}</div>`);
        });
        return card;
      };
      let any = false;
      const renderGroup = (label, mons) => {
        if (!mons.length) return;
        any = true;
        body.insertAdjacentHTML("beforeend", `<h3 class="cx-group">${label} <small>(${mons.length})</small></h3>`);
        const gr = document.createElement("div"); gr.className = "cx-grid";
        mons.sort((a, b) => (a.hp || 0) - (b.hp || 0)).forEach((m) => gr.appendChild(monCard(m)));
        body.appendChild(gr);
      };
      zoneOrder.forEach((zid, i) => renderGroup(`Lv${i + 1} · ${g.zones[zid].name}`, groups[i]));
      renderGroup("기타 (특수)", other);
      if (!any) body.innerHTML = "<p class='muted'>결과 없음</p>";
      return;
    } else if (key === "items") {
      const TYPE = { seed: "씨앗", produce: "수확물", potion: "포션", equipment: "장비", tool: "도구", general: "일반" };
      // 장비 스탯 = base × (강화+1)
      const statText = (s, enh) => {
        const m = enh + 1, p = [];
        if (s.atk) p.push(`ATK ${Math.round(s.atk * m)}`);
        if (s.def) p.push(`DEF ${Math.round(s.def * m)}`);
        if (s.hp) p.push(`HP ${Math.round(s.hp * m)}`);
        if (s.mp) p.push(`MP ${Math.round(s.mp * m)}`);
        return p.join(" · ") || "스탯 없음";
      };
      Object.entries(g.items || {}).forEach(([code, it]) => {
        if (!match(it.name) || isTest(code, it) || it.type === "potion") return;  // 포션은 전용 탭
        const stat = g.equipment_stats?.[code];
        const rows = [["분류", TYPE[it.type] || it.type]];
        if (it.brewDuration_ms) rows.push(["제작시간", fmtDuration(it.brewDuration_ms)]);
        const rec = craftByOut[code];
        if (rec) rows.push(["필요레벨", `Lv ${rec.requiredLevel}`]);
        const card = cxCard((ic) => itemIcon(ic, code), it.name, rows);
        // 장비: 강화도 +/- 로 스탯 변화 확인
        if (stat && (stat.atk || stat.def || stat.hp || stat.mp)) {
          const ctrl = document.createElement("div");
          ctrl.className = "cx-enh-ctrl";
          ctrl.innerHTML = `<span class="cx-enh-lbl">강화</span>
            <button class="cx-enh-btn" data-d="-1">−</button><b class="cx-enh-lv">+0</b>
            <button class="cx-enh-btn" data-d="1">+</button>
            <span class="cx-enh-stat"></span>`;
          let enh = 0;
          const lvEl = ctrl.querySelector(".cx-enh-lv"), statEl = ctrl.querySelector(".cx-enh-stat");
          const upd = () => { lvEl.textContent = `+${enh}`; statEl.textContent = statText(stat, enh); };
          ctrl.querySelectorAll(".cx-enh-btn").forEach((b) => b.onclick = () => { enh = Math.max(0, enh + (+b.dataset.d)); upd(); });
          upd();
          card.appendChild(ctrl);
        }
        if (rec) ingRow(card, "제작", rec.inputs);
        sourceRow(card, code);
        const gem = g.gem_effects?.[code];
        if (gem) card.insertAdjacentHTML("beforeend",
          `<div class="cx-perk">💎 세공효과 · <b>${gem.name}</b><br>${fmtFormula(gem.desc)}</div>`);
        const skins = g.item_skins?.[code];
        if (skins) card.insertAdjacentHTML("beforeend",
          `<div class="cx-source"><b>🎨 외형</b> ${skins.length}종 · ${skins.join(" · ")}</div>`);
        if (it.description) card.insertAdjacentHTML("beforeend", `<div class="cx-flavor">“${it.description}”</div>`);
        grid.appendChild(card);
      });
    } else if (key === "transmute") {
      // 변성: 가마솥에 변성도구 + 대상을 넣어 변환
      const TOOLS = [
        { code: "condensing_flask", tgt: "포션", desc: "포션을 플라스크에 담아 농축 (강화도+1개까지 보관)" },
        { code: "dissolution_potion", tgt: "장비", desc: "장비에 박힌 세공 보석을 녹여 추출" },
        { code: "shatter_potion", tgt: "아무 아이템", desc: "대상의 강화도 −1 (성공률 = 0.5^강화도 차이)" },
        { code: "opaque_sediment", tgt: "판매가 있는 아이템", desc: "같은 타입의 비슷한 가치 아이템으로 변환 (가치 기반)" },
      ];
      TOOLS.forEach((t) => {
        if (!match(g.items?.[t.code]?.name || "")) return;
        grid.appendChild(cxCard((ic) => itemIcon(ic, t.code), `${g.items?.[t.code]?.name || t.code}`, [
          ["대상", t.tgt], ["효과", t.desc],
        ]));
      });
      body.appendChild(grid);
      // 불투명한 침전물 가치 테이블
      if (!q) {
        const TY = { produce: "수확물", potion: "포션", general: "일반", equipment: "장비", tool: "도구", seed: "씨앗" };
        const byType = {};
        for (const [code, v] of Object.entries(g.item_values || {})) {
          const tp = g.items?.[code]?.type || "기타";
          (byType[tp] ??= []).push([code, v]);
        }
        const rangeRows = [0, 1, 2, 5, 10].map((e) => `+${e} → ${Math.min(100, e * 10)}%~100%`).join(" · ");
        body.insertAdjacentHTML("beforeend",
          `<div class="tr-note">🔀 <b>불투명한 침전물</b>은 순수 랜덤이 아니라 <b>가치 기반</b>이에요.<br>
          <b>결과 가치 = 입력 가치 × 2^입력강화 × f</b> · <b>f = min + (1−min)×랜덤</b> · <b>min = 침전물강화 × 10%</b>(최대 100%)<br>
          즉 침전물 강화가 <b>결과 가치의 하한</b>을 정함 (상한 100%): ${rangeRows}<br>
          그 가치 범위에서 <b>같은 타입</b>의 가장 가까운(이하) 아이템이 결과. 아래는 아이템 가치표.</div>`);
        for (const tp of ["seed", "produce", "potion", "general", "equipment", "tool"]) {
          const list = (byType[tp] || []).sort((a, b) => a[1] - b[1]);
          if (!list.length) continue;
          body.insertAdjacentHTML("beforeend", `<h3 class="cx-group">💎 ${TY[tp] || tp} <small>(${list.length})</small></h3>`);
          const tg = document.createElement("div"); tg.className = "tr-vals";
          list.forEach(([code, v]) => {
            tg.insertAdjacentHTML("beforeend",
              `<div class="tr-val"><span class="tr-vic" data-ic="${code}"></span><span class="tr-vn">${g.items?.[code]?.name || code}</span><b>${fmt(v)}</b></div>`);
          });
          body.appendChild(tg);
          tg.querySelectorAll(".tr-vic[data-ic]").forEach((e) => itemIcon(e, e.dataset.ic));
        }
      }
      return;
    }
    if (!grid.children.length) body.innerHTML = "<p class='muted'>결과 없음</p>";
    else body.appendChild(grid);
  };

  view.querySelectorAll("#cxcats button").forEach((b) => {
    b.onclick = () => {
      view.querySelectorAll("#cxcats button").forEach((x) => x.classList.toggle("active", x === b));
      cur = b.dataset.k; render(cur, qInput.value);
    };
  });
  qInput.oninput = () => render(cur, qInput.value);
  render(cur);
}

function cxCard(iconFn, title, rows) {
  const card = document.createElement("div");
  card.className = "cx-card";
  const head = document.createElement("div");
  head.className = "cx-head";
  const ic = document.createElement("span");
  ic.className = "cx-ic";
  iconFn(ic);
  head.appendChild(ic);
  head.insertAdjacentHTML("beforeend", `<span class="cx-title">${title}</span>`);
  card.appendChild(head);
  card.insertAdjacentHTML("beforeend",
    `<div class="cx-rows">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>`);
  return card;
}

function fmtFormula(x) {
  if (!x) return "—";
  return String(x)
    .replace(/\$\{([^}]+)\}/g, (_, expr) => expr.replace(/\be\b/g, "Lv").replace(/\*/g, "×").trim())
    .replace(/\|/g, "/");
}
