import { gamedata } from "./api.js";
import { skillIcon } from "./sprites.js";

const TREE_LABEL = {
  farming: "🌱 재배", brewing: "⚗️ 연성", mana: "🔷 마나",
  contract: "📜 계약", trade: "✉️ 교역", harvest: "🌾 수확", growth: "🌿 성장", crafting: "🔨 제작",
};
const ORDER = ["farming", "brewing", "mana", "contract", "trade"];

function fmtFormula(x) {
  if (!x) return "";
  return String(x)
    .replace(/\$\{([^}]+)\}/g, (_, e) => e.replace(/\be\b/g, "Lv").replace(/\*/g, "×").trim())
    .replace(/\|/g, "/");
}

// 트리 레이아웃: depth=행, 각 노드를 부모 평균 열에 배치(충돌 시 우측 이동) → 선 정렬
function layout(ids, skills) {
  const inTree = new Set(ids);
  const memo = {};
  const depth = (id, seen = new Set()) => {
    if (id in memo) return memo[id];
    if (seen.has(id)) return 0;
    seen.add(id);
    const pre = (skills[id]?.prereqs || []).filter((p) => inTree.has(p.id));
    return (memo[id] = pre.length ? 1 + Math.max(...pre.map((p) => depth(p.id, seen))) : 0);
  };
  const byRow = {};
  ids.forEach((id) => (byRow[depth(id)] ??= []).push(id));
  const rows = Math.max(...Object.keys(byRow).map(Number)) + 1;
  const anchor = (id) => {
    const ps = (skills[id]?.prereqs || []).map((p) => pos[p.id]?.col).filter((x) => x != null);
    return ps.length ? ps.reduce((s, v) => s + v, 0) / ps.length : null;
  };
  const pos = {};
  let maxCol = 0;
  for (let d = 0; d < rows; d++) {
    const lv = (byRow[d] || []).slice().sort((a, b) =>
      (anchor(a) ?? 1e9) - (anchor(b) ?? 1e9) || (skills[a]?.name || "").localeCompare(skills[b]?.name || ""));
    const occupied = new Set();
    let nextFree = 0;
    lv.forEach((id) => {
      const a = anchor(id);
      let col = a == null ? nextFree : Math.round(a);
      while (occupied.has(col)) col++;
      occupied.add(col);
      pos[id] = { row: d, col };
      nextFree = Math.max(nextFree, col + 1);
      maxCol = Math.max(maxCol, col);
    });
  }
  // 빈 열 압축 (레이아웃 깨짐/과도한 폭 방지)
  const used = [...new Set(Object.values(pos).map((p) => p.col))].sort((a, b) => a - b);
  const remap = {}; used.forEach((c, i) => (remap[c] = i));
  Object.values(pos).forEach((p) => (p.col = remap[p.col]));
  return { pos, rows, cols: used.length };
}

export async function renderSkillTree(view) {
  const g = await gamedata();
  const skills = g.skills || {};
  const byTree = {};
  for (const [id, sk] of Object.entries(skills)) (byTree[sk.treeId] ??= []).push(id);
  const trees = ORDER.filter((t) => byTree[t]).concat(Object.keys(byTree).filter((t) => !ORDER.includes(t)));
  const nameOf = (id) => skills[id]?.name || id;

  const mobile = window.matchMedia("(max-width: 640px)").matches;
  view.innerHTML = `<h2>🌳 스킬 트리</h2>
    <p class="muted">${mobile ? "단계별 목록 · ↑ 선행 스킬과 요구 레벨" : "선들이 선행 스킬 → 해금 스킬 연결을 나타냅니다 (위 → 아래)"}</p>`;

  // 노드 카드 HTML
  const nodeHTML = (id) => {
    const sk = skills[id];
    const pre = (sk.prereqs || []).filter((q) => skills[q.id]);
    return `
      <span class="sn-ic" data-sk="${id}"></span>
      <div class="sn-body">
        <div class="sn-name">${sk.name} <span class="sn-lv">${sk.maxLevel}</span></div>
        <div class="sn-desc">${fmtFormula(sk.formula || sk.description)}</div>
        ${pre.length ? `<div class="sn-pre">↑ ${pre.map((q) => `${nameOf(q.id)} <i>${q.level}</i>`).join(", ")}</div>` : ""}
      </div>`;
  };

  // ── 모바일: 단계별 단일컬럼 목록 ──
  if (mobile) {
    for (const t of trees) {
      const { pos, rows } = layout(byTree[t], skills);
      const byTier = {};
      byTree[t].forEach((id) => (byTier[pos[id].row] ??= []).push(id));
      const sec = document.createElement("section");
      sec.className = "st-tree";
      sec.innerHTML = `<h3>${TREE_LABEL[t] || t} <small>(${byTree[t].length})</small></h3>`;
      for (let d = 0; d < rows; d++) {
        (byTier[d] || []).forEach((id) => {
          const el = document.createElement("div");
          el.className = "st-node st-node-m";
          el.innerHTML = `<span class="st-tierbadge">${d + 1}</span>` + nodeHTML(id);
          sec.appendChild(el);
        });
      }
      sec.querySelectorAll(".sn-ic[data-sk]").forEach((e) => skillIcon(e, e.dataset.sk));
      view.appendChild(sec);
    }
    return;
  }

  for (const t of trees) {
    const { pos, rows, cols } = layout(byTree[t], skills);
    const sec = document.createElement("section");
    sec.className = "st-tree";
    sec.innerHTML = `<h3>${TREE_LABEL[t] || t} <small>(${byTree[t].length})</small></h3>`;
    const scroll = document.createElement("div");
    scroll.className = "st-scroll";
    const graph = document.createElement("div");
    graph.className = "st-graph";
    graph.style.setProperty("--cols", cols);
    graph.style.setProperty("--rows", rows);

    // SVG 연결선 (data-p=선행, data-c=해금)
    const cx = (c) => ((c + 0.5) / cols) * 100;
    const cy = (r) => ((r + 0.5) / rows) * 100;
    const lines = byTree[t].flatMap((id) => {
      const ch = pos[id];
      return (skills[id]?.prereqs || []).map((p) => {
        const pa = pos[p.id];
        if (!pa || !ch) return "";
        return `<line data-p="${p.id}" data-c="${id}" x1="${cx(pa.col)}" y1="${cy(pa.row)}" x2="${cx(ch.col)}" y2="${cy(ch.row)}"/>`;
      }).join("");
    }).join("");
    graph.insertAdjacentHTML("beforeend",
      `<svg class="st-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>`);

    // 노드
    byTree[t].forEach((id) => {
      const sk = skills[id]; const p = pos[id];
      const el = document.createElement("div");
      el.className = "st-node";
      el.dataset.id = id;
      el.style.gridColumn = p.col + 1;
      el.style.gridRow = p.row + 1;
      const ic = document.createElement("span"); ic.className = "sn-ic"; skillIcon(ic, id);
      el.appendChild(ic);
      const pre = (sk.prereqs || []).filter((q) => skills[q.id]);
      el.insertAdjacentHTML("beforeend", `
        <div class="sn-body">
          <div class="sn-name">${sk.name} <span class="sn-lv">${sk.maxLevel}</span></div>
          <div class="sn-desc">${fmtFormula(sk.formula || sk.description)}</div>
          ${pre.length ? `<div class="sn-pre">↑ ${pre.map((q) => `${nameOf(q.id)} <i>${q.level}</i>`).join(", ")}</div>` : ""}
        </div>`);
      el.title = sk.flavor || "";
      // hover: 선행 체인만 강조
      el.onmouseenter = () => {
        const chain = new Set();
        (function collect(sid) {
          chain.add(sid);
          (skills[sid]?.prereqs || []).forEach((q) => { if (skills[q.id] && !chain.has(q.id)) collect(q.id); });
        })(id);
        graph.classList.add("dim");
        chain.forEach((cid) => graph.querySelector(`.st-node[data-id="${cid}"]`)?.classList.add("hl"));
        graph.querySelectorAll(".st-lines line").forEach((l) => {
          if (chain.has(l.dataset.c) && chain.has(l.dataset.p)) l.classList.add("hl");
        });
      };
      el.onmouseleave = () => {
        graph.classList.remove("dim");
        graph.querySelectorAll(".hl").forEach((e) => e.classList.remove("hl"));
      };
      graph.appendChild(el);
    });
    scroll.appendChild(graph);
    sec.appendChild(scroll);
    view.appendChild(sec);
  }
}
