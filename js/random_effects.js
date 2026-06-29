import { gamedata } from "./api.js";
import { itemIcon } from "./sprites.js";

const fmt = (n) => (n == null ? "-" : Number(n).toLocaleString());
const pct = (v) => {
  const p = v * 100;
  return `${p >= 10 ? p.toFixed(1) : p >= 1 ? p.toFixed(2) : p.toFixed(3)}%`;
};

export const RANDOM_EFFECTS = {
  dream_potion: {
    kind: "produce",
    label: "랜덤 수확물",
    resultEnh: "source",
    exponentPerEnh: 0.25,
    exponentCap: 1,
    effectLabel: "몽환 +강",
    sourceLabel: "수확될 +강",
    formula: "다음 1회 수확 시 랜덤 작물 (강화 시 고가치 작물 확률 증가)",
    base: "다음 1회 수확 시 랜덤 작물 (강화 시 고가치 작물 확률 증가)",
    note: "몽환은 이번 수확 결과의 아이템 종류만 랜덤 작물로 바꾸고, 결과물에 붙을 +강은 그대로 유지합니다.",
  },
  comet_potion: {
    kind: "seed",
    label: "랜덤 씨앗",
    exponentPerEnh: 0.35,
    exponentCap: 1.2,
    effectLabel: "혜성 +강",
    formula: "하늘에서 랜덤 씨앗 획득 (강화 시 고가치 씨앗 확률 증가)",
    base: "하늘에서 랜덤 씨앗 획득 (강화 시 고가치 씨앗 확률 증가)",
    note: "씨앗은 +0으로 지급됩니다.",
  },
  mirage_potion: {
    kind: "potion",
    label: "랜덤 출정 포션",
    exclude: new Set(["condensing_flask"]),
    resultEnh: "effect",
    exponentPerEnh: 0.25,
    exponentCap: 1,
    effectLabel: "신기루 +강",
    formula: "다음 출정 시 랜덤 +${e} 포션 1개 추가 (강화 시 고가치 포션 확률 증가)",
    base: "다음 출정 시 랜덤 포션 추가 (강화 시 고가치 포션 확률 증가)",
    note: "추가 포션 강화도 = 신기루포션 강화도입니다.",
  },
  daydream_potion: {
    kind: "potion",
    label: "랜덤 양조 포션",
    exclude: new Set(["condensing_flask"]),
    resultEnh: "source",
    exponentPerEnh: 0.25,
    exponentCap: 1,
    effectLabel: "백일몽 +강",
    sourceLabel: "완성될 +강",
    formula: "다음 1회 양조 시 랜덤 포션 (강화 시 고가치 포션 확률 증가)",
    base: "다음 1회 양조 시 랜덤 포션 (강화 시 고가치 포션 확률 증가)",
    note: "백일몽은 이번 양조 결과의 아이템 종류만 랜덤 포션으로 바꾸고, 결과물에 붙을 +강은 그대로 유지합니다.",
  },
};

const RANDOM_ORDER = ["dream_potion", "comet_potion", "mirage_potion", "daydream_potion"];

const randomValueOf = (g, code, output = false) => {
  const v = output
    ? (g.item_output_values?.[code] ?? g.item_values?.[code] ?? g.sell_price?.[code])
    : (g.item_values?.[code] ?? g.sell_price?.[code]);
  return Number.isFinite(v) && v > 0 ? v : null;
};

const isTestItem = (g, code, it) => {
  const testSet = new Set(g.test_items || []);
  return testSet.has(code)
    || code === "growth_elixir"
    || code === "poison_fang"
    || /^aging_/.test(code)
    || it?.test === true
    || (it?.name || "").includes("시험용");
};

const randomCandidates = (g, cfg) => Object.entries(g.items || {})
  .filter(([code, it]) => it.type === cfg.kind
    && !cfg.exclude?.has(code)
    && !isTestItem(g, code, it)
    && randomValueOf(g, code, true) != null)
  .map(([code]) => code);

export function randomDistribution(g, code, enh, sourceEnh = 0) {
  const cfg = RANDOM_EFFECTS[code];
  if (!cfg) return null;
  const resultEnh = cfg.resultEnh === "effect" ? enh : cfg.resultEnh === "source" ? sourceEnh : 0;
  const entries = randomCandidates(g, cfg).flatMap((c) => {
    const v = randomValueOf(g, c, true);
    return v == null ? [] : [{ code: c, value: v * Math.pow(3, resultEnh) }];
  });
  if (!entries.length) return null;

  const minValue = Math.min(...entries.map((it) => it.value));
  const exponent = Math.min(enh * cfg.exponentPerEnh, cfg.exponentCap);
  const weights = entries.map((it) => Math.pow(it.value / minValue, exponent));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const rows = entries.map((it, i) => ({ ...it, prob: weights[i] / total }))
    .sort((a, b) => b.prob - a.prob
      || b.value - a.value
      || (g.items?.[a.code]?.name || a.code).localeCompare(g.items?.[b.code]?.name || b.code));
  const expected = rows.reduce((sum, it) => sum + it.value * it.prob, 0);
  return { cfg, exponent, expected, resultEnh, rows };
}

const evalFormula = (tpl, e) => String(tpl || "").replace(/\$\{([^}]+)\}/g, (_, expr) => {
  try {
    const v = new Function("e", "Math", "return (" + expr + ")")(e, Math);
    return typeof v === "number" ? fmt(v) : String(v);
  } catch {
    return "?";
  }
});

function renderRandomCard(g, code) {
  const cfg = RANDOM_EFFECTS[code];
  const item = g.items?.[code] || {};
  const hasSourceEnh = cfg.resultEnh === "source";
  const card = document.createElement("section");
  card.className = "rand-card";
  card.innerHTML = `
    <div class="rand-head">
      <span class="rand-potion-ic"></span>
      <div><b>${item.name || code}</b><small>${cfg.label}</small></div>
    </div>
    <div class="rand-effect"></div>
    <div class="rand-controls">
      <span>${cfg.effectLabel || "효과 +강"}</span>
      <button type="button" class="rand-step" data-d="-1">−</button>
      <b class="rand-lv">+0</b>
      <button type="button" class="rand-step" data-d="1">+</button>
    </div>
    ${hasSourceEnh ? `<div class="rand-controls">
      <span>${cfg.sourceLabel}</span>
      <button type="button" class="rand-step rand-source-step" data-d="-1">−</button>
      <b class="rand-lv rand-source-lv">+0</b>
      <button type="button" class="rand-step rand-source-step" data-d="1">+</button>
    </div>` : ""}
    <div class="rand-summary"></div>
    <div class="rand-list"></div>
    <div class="rand-note"></div>`;
  itemIcon(card.querySelector(".rand-potion-ic"), code);

  const effectEl = card.querySelector(".rand-effect");
  const lvEl = card.querySelector(".rand-lv");
  const sourceLvEl = card.querySelector(".rand-source-lv");
  const summaryEl = card.querySelector(".rand-summary");
  const listEl = card.querySelector(".rand-list");
  const noteEl = card.querySelector(".rand-note");
  let enh = 0;
  let sourceEnh = 0;
  let expanded = false;

  const update = () => {
    const dist = randomDistribution(g, code, enh, sourceEnh);
    lvEl.textContent = `+${enh}`;
    if (sourceLvEl) sourceLvEl.textContent = `+${sourceEnh}`;
    effectEl.textContent = evalFormula(cfg.formula, enh);
    if (!dist) {
      summaryEl.innerHTML = "";
      listEl.innerHTML = "<div class='muted'>계산할 후보가 없습니다.</div>";
      return;
    }
    summaryEl.innerHTML = `
      <span>가중 <b>${dist.exponent ? `x^${dist.exponent.toFixed(2)}` : "균등"}</b></span>
      <span>기대 <b>${fmt(Math.round(dist.expected))}</b></span>
      <span>후보 <b>${dist.rows.length}종${dist.resultEnh ? ` · 결과 +${dist.resultEnh}` : ""}</b></span>`;

    const shown = expanded ? dist.rows : dist.rows.slice(0, 10);
    const rest = dist.rows.slice(10).reduce((sum, it) => sum + it.prob, 0);
    listEl.innerHTML = shown.map((it) => {
      const name = `${g.items?.[it.code]?.name || it.code}${dist.resultEnh ? `+${dist.resultEnh}` : ""}`;
      return `<div class="rand-row">
        <span class="rand-ic" data-ic="${it.code}"></span>
        <span class="rand-name">${name}</span>
        <small>${fmt(Math.round(it.value))}</small>
        <b>${pct(it.prob)}</b>
      </div>`;
    }).join("")
      + (!expanded && rest > 0 ? `<div class="rand-rest">그 외 ${dist.rows.length - shown.length}종 <b>${pct(rest)}</b></div>` : "")
      + (dist.rows.length > 10 ? `<button type="button" class="rand-toggle">${expanded ? "접기" : `전체 ${dist.rows.length}종 보기`}</button>` : "");
    listEl.querySelectorAll(".rand-ic[data-ic]").forEach((ic) => itemIcon(ic, ic.dataset.ic));
    listEl.querySelector(".rand-toggle")?.addEventListener("click", () => {
      expanded = !expanded;
      update();
    });
    noteEl.textContent = cfg.note;
  };

  card.querySelectorAll(".rand-step").forEach((btn) => {
    btn.onclick = () => {
      enh = Math.max(0, enh + Number(btn.dataset.d || 0));
      update();
    };
  });
  card.querySelectorAll(".rand-source-step").forEach((btn) => {
    btn.onclick = () => {
      sourceEnh = Math.max(0, sourceEnh + Number(btn.dataset.d || 0));
      update();
    };
  });
  update();
  return card;
}

export async function renderRandomEffects(view) {
  const g = await gamedata();
  view.innerHTML = `<h2>🎲 확률표</h2><div id="rand-grid" class="rand-grid"></div>`;
  const grid = view.querySelector("#rand-grid");
  RANDOM_ORDER.forEach((code) => grid.appendChild(renderRandomCard(g, code)));
}
