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
        if (!match(it.name)) return;
        const combat = g.potion_effects?.[code];
        const use = g.potion_use_effects?.[code];
        const txt = (e) => e && (e.base || fmtFormula(e.formula));
        const rows = [["양조", fmtDuration(it.brewDuration_ms)]];
        if (txt(use)) rows.push(["🧪 사용", txt(use)]);
        if (txt(combat)) {
          const tgt = combat.targets?.map((t) => TARGET[t] || t).join(", ");
          const showTgt = tgt && !/자신|아군|적/.test(txt(combat));
          rows.push(["⚔️ 전투", txt(combat) + (showTgt ? ` (${tgt})` : "")]);
        }
        if (!txt(use) && !txt(combat)) rows.push(["효과", "—"]);
        const card = cxCard((ic) => itemIcon(ic, code), it.name, rows);
        if (brewByOut[code]) ingRow(card, "재료", brewByOut[code]);
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
      Object.entries(g.items || {}).forEach(([code, it]) => {
        if (!match(it.name)) return;
        const stat = g.equipment_stats?.[code];
        const rows = [["분류", TYPE[it.type] || it.type]];
        if (stat) rows.push(["스탯", `ATK ${stat.atk} DEF ${stat.def} HP ${stat.hp} MP ${stat.mp}`]);
        if (it.brewDuration_ms) rows.push(["제작시간", fmtDuration(it.brewDuration_ms)]);
        const rec = craftByOut[code];
        if (rec) rows.push(["필요레벨", `Lv ${rec.requiredLevel}`]);
        const card = cxCard((ic) => itemIcon(ic, code), it.name, rows);
        if (rec) ingRow(card, "제작", rec.inputs);
        const gem = g.gem_effects?.[code];
        if (gem) card.insertAdjacentHTML("beforeend",
          `<div class="cx-perk">💎 세공효과 · <b>${gem.name}</b><br>${fmtFormula(gem.desc)}</div>`);
        if (it.description) card.insertAdjacentHTML("beforeend", `<div class="cx-flavor">“${it.description}”</div>`);
        grid.appendChild(card);
      });
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
