import { gamedata } from "./api.js";
import { itemIcon, fmtMinutes } from "./sprites.js";
import { RANDOM_EFFECTS } from "./random_effects.js";

const $ = (s, r = document) => r.querySelector(s);
const fmt = (n, digits = 1) => Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
const pct = (v) => `${(v * 100).toFixed(v >= 0.1 ? 1 : v >= 0.01 ? 2 : 3)}%`;
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (ch) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

const TYPE = { seed: "씨앗", produce: "수확물", potion: "포션", equipment: "장비", tool: "도구", general: "일반" };
const TARGET = { self: "자신", enemy_one: "적 단일", enemy_all: "적 전체", ally_one: "아군", ally_all: "아군 전체" };
const PHF = {
  wn: (e) => e + 1,
  ku: (e) => e + 1,
  gi: (e) => Math.floor((e + 2) / 2),
  Jt: (e) => 4 * (e + 1),
  YP: (e) => 4 ** e,
  Oh: (e) => e * 2,
  uy: () => 25,
  GP: (e) => (e + 1) * 0.3,
  HP: (e) => (e + 1) * 10,
  $P: (e) => (e + 1) * 5,
};

let g = {};

function q2(parts, salt = "") {
  let n = 2166136261;
  for (const s of salt ? [...parts, salt] : parts) {
    for (let i = 0; i < s.length; i++) {
      n ^= s.charCodeAt(i);
      n = Math.imul(n, 16777619) >>> 0;
    }
    n ^= 255;
    n = Math.imul(n, 16777619) >>> 0;
  }
  return n >>> 0;
}
const rng = (parts, salt = "") => q2(parts.map(String), salt) / 4294967296;
const makeId = (parts) => q2(parts.map(String)).toString(36);

function splitTopLevel(value) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(value.slice(start, i));
      start = i + 1;
    }
  }
  out.push(value.slice(start));
  return out;
}

function parseItemKey(raw) {
  const flags = { untradable: false, bundled: false };
  let key = String(raw || "");
  for (;;) {
    const p = key.lastIndexOf("~");
    if (p < 0) break;
    const suffix = key.slice(p + 1);
    if (!/^[tb]+$/.test(suffix)) break;
    flags.untradable ||= suffix.includes("t");
    flags.bundled ||= suffix.includes("b");
    key = key.slice(0, p);
  }
  const paren = key.indexOf("(");
  const base = paren >= 0 ? key.slice(0, paren) : key;
  const engravedRaw = paren >= 0 && key.endsWith(")") ? key.slice(paren + 1, -1) : "";
  const plus = base.lastIndexOf("+");
  if (plus < 0) return null;
  const itemCode = base.slice(0, plus);
  const enhancement = Number(base.slice(plus + 1));
  if (!g.items?.[itemCode] || !Number.isInteger(enhancement) || enhancement < 0) return null;
  const engraved = engravedRaw
    ? splitTopLevel(engravedRaw).map((part) => part.trim() ? parseItemKey(part.trim()) : null)
    : [];
  return {
    itemCode,
    enhancement,
    ...(engraved.length ? { engraved } : {}),
    ...(flags.untradable ? { untradable: true } : {}),
    ...(flags.bundled ? { bundled: true } : {}),
  };
}

function itemKeyOf(item) {
  let key = `${item.itemCode}+${item.enhancement}`;
  if (item.engraved?.length) {
    key += `(${item.engraved.map((gem) => gem ? itemKeyOf(gem) : "").join(",")})`;
  }
  const suffix = `${item.bundled ? "b" : ""}${item.untradable ? "t" : ""}`;
  return suffix ? `${key}~${suffix}` : key;
}

function itemName(code) {
  return g.items?.[code]?.name || code;
}

function inventoryFromJson() {
  const raw = $("#inventory-json").value.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.inventory && typeof parsed.inventory === "object" ? parsed.inventory : parsed;
  } catch {
    return null;
  }
}

function resolveById(id) {
  const inv = inventoryFromJson();
  if (!inv || !id) return null;
  if (Array.isArray(inv)) {
    const row = inv.find((it) => String(it.id) === String(id));
    if (!row) return null;
    if (row.itemKey) {
      const parsed = parseItemKey(row.itemKey);
      return parsed ? { id, itemKey: row.itemKey, ...parsed } : null;
    }
    if (row.itemCode && Number.isInteger(row.enhancement)) return { id, itemKey: itemKeyOf(row), ...row };
    return null;
  }
  for (const [itemKey, ids] of Object.entries(inv)) {
    if (Array.isArray(ids) && ids.map(String).includes(String(id))) {
      const parsed = parseItemKey(itemKey);
      return parsed ? { id, itemKey, ...parsed } : null;
    }
  }
  return null;
}

function clampInt(id, min, max) {
  const el = $(id);
  const n = Math.max(min, Math.min(max, Math.floor(Number(el.value) || 0)));
  el.value = n;
  return n;
}

function manualItem(id, enhId) {
  const itemCode = $("#manual-code").value.trim();
  const enhancement = clampInt(enhId, 0, 99);
  if (!g.items?.[itemCode]) return null;
  const item = { id: $(id).value.trim() || id.slice(1), itemCode, enhancement };
  return { ...item, itemKey: itemKeyOf(item) };
}

function readState() {
  const id1 = $("#material-id-1").value.trim();
  const id2 = $("#material-id-2").value.trim();
  const cauldron = clampInt("#cauldron-enh", 0, 99);
  const wick = clampInt("#wick-level", 0, 10);
  const familiar = clampInt("#familiar", 0, 10);
  const fog = $("#fog").checked;
  const zoneBuff = $("#zone-buff").checked;
  const coeff = familiar * 0.1 + (fog ? 1 : 0) + (zoneBuff ? 0.5 : 0);
  const item1 = resolveById(id1) || manualItem("#material-id-1", "#manual-enh-1");
  const item2 = resolveById(id2) || manualItem("#material-id-2", "#manual-enh-2");
  return {
    id1, id2, item1, item2, cauldron, wick, familiar, fog, zoneBuff, coeff,
    zone: $("#zone").value,
    selfCauldron: $("#self-cauldron").checked,
    seedIngredient: $("#seed-ingredient").checked,
  };
}

function baseRate(e1, e2) {
  return 0.5 * Math.pow(0.5, Math.max(e1, e2) - Math.min(e1, e2));
}

function wickBonus(base, wick, cauldron) {
  if (wick <= 0) return 0;
  return (1 - Math.pow(1 - 0.005 * wick, cauldron + 1)) * base;
}

function enhancementRate(st) {
  const toolEnh = st.selfCauldron ? Math.max(st.cauldron, st.item1.enhancement, st.item2.enhancement) : st.cauldron;
  const base = baseRate(st.item1.enhancement, st.item2.enhancement);
  let rate = Math.min(0.75, base + wickBonus(base, st.wick, toolEnh));
  if (st.zone === "wind_corridor" && g.items?.[st.item1.itemCode]?.type === "seed") {
    rate = Math.min(1, rate * (1 + 0.05 * st.coeff));
  }
  return { base, toolEnh, rate };
}

function addOutcome(map, status, items, rate) {
  if (rate <= 0) return;
  const key = JSON.stringify({ status, items: items.map((it) => ({ itemKey: it.itemKey, id: it.id, originalId: it.originalId })) });
  const prev = map.get(key);
  if (prev) prev.rate += rate;
  else map.set(key, { status, items, rate });
}

function resultFromInherit(st, inherit, extraEnh = 0) {
  const item = {
    id: makeId([st.item1.id, st.item2.id]),
    itemCode: st.item1.itemCode,
    enhancement: Math.max(st.item1.enhancement, st.item2.enhancement) + 1 + extraEnh,
    ...(inherit.engraved?.length ? { engraved: inherit.engraved } : {}),
    ...(st.item1.untradable || st.item2.untradable ? { untradable: true } : {}),
  };
  return { id: item.id, itemKey: itemKeyOf(item) };
}

function increaseItemRef(ref) {
  const parsed = parseItemKey(ref.itemKey);
  if (!parsed) return ref;
  return { ...ref, itemKey: itemKeyOf({ ...parsed, enhancement: parsed.enhancement + 1 }) };
}

function outcomes(st) {
  if (!st.item1 || !st.item2) return { error: "재료 ID를 스냅샷에서 찾지 못했고 수동 아이템 코드도 올바르지 않습니다." };
  if (st.item1.id === st.item2.id) return { error: "같은 고유 ID를 두 재료로 동시에 사용할 수 없습니다." };
  if (st.item1.itemCode !== st.item2.itemCode) return { error: "강화는 같은 종류의 아이템 2개만 가능합니다." };
  const itemMeta = g.items?.[st.item1.itemCode];
  if (!itemMeta) return { error: "알 수 없는 아이템 코드입니다." };
  if (itemMeta.type === "produce") return { error: "수확물은 일반 강화 대상이 아닙니다." };
  if (itemMeta.type === "seed" && !st.seedIngredient) return { error: "씨앗 강화는 생명의 씨앗 마법이 필요합니다." };

  const rates = enhancementRate(st);
  const map = new Map();
  const midEcho = st.zone === "mid_cave" && itemMeta.type === "general" ? Math.min(1, 0.04 * st.coeff) : 0;
  for (const inherit of [st.item1, st.item2]) {
    addOutcome(map, "success", [resultFromInherit(st, inherit, 0)], (rates.rate / 2) * (1 - midEcho));
    addOutcome(map, "great_success", [resultFromInherit(st, inherit, 1)], (rates.rate / 2) * midEcho);
  }
  const sunset = st.zone === "sunset_cliff" ? Math.min(1, 0.05 * st.coeff) : 0;
  if (sunset > 0) {
    const before = [...map.values()];
    map.clear();
    for (const out of before) {
      addOutcome(map, out.status, out.items, out.rate * (1 - sunset));
      addOutcome(map, "great_success", out.items.map(increaseItemRef), out.rate * sunset);
    }
  }

  const failRate = 1 - rates.rate;
  const restore = st.zone === "forgotten_fortress" ? Math.min(1, 0.1 * st.coeff) : 0;
  const ordinaryFail = failRate * (1 - restore);
  if (st.item1.itemKey === st.item2.itemKey) addOutcome(map, "failure", [{ id: st.item1.id, itemKey: st.item1.itemKey }], ordinaryFail);
  else {
    addOutcome(map, "failure", [{ id: st.item1.id, itemKey: st.item1.itemKey }], ordinaryFail / 2);
    addOutcome(map, "failure", [{ id: st.item2.id, itemKey: st.item2.itemKey }], ordinaryFail / 2);
  }
  if (restore > 0) {
    addOutcome(map, "failure", [
      { id: makeId([st.item1.id, st.item2.id, "forgotten_fortress_restore", "0", st.item1.id]), itemKey: st.item1.itemKey, originalId: st.item1.id },
      { id: makeId([st.item1.id, st.item2.id, "forgotten_fortress_restore", "1", st.item2.id]), itemKey: st.item2.itemKey, originalId: st.item2.id },
    ], failRate * restore);
  }

  const list = [...map.values()].sort((a, b) => {
    const ea = parseItemKey(a.items[0]?.itemKey)?.enhancement ?? -1;
    const eb = parseItemKey(b.items[0]?.itemKey)?.enhancement ?? -1;
    return b.rate - a.rate || eb - ea || a.status.localeCompare(b.status);
  });
  return { rates, list };
}

function pickOutcome(st, list) {
  const roll = rng([st.item1.id, st.item2.id], "outcome");
  let sum = 0;
  for (const out of list) {
    sum += out.rate;
    if (roll < sum) return { roll, out };
  }
  return { roll, out: list[list.length - 1] };
}

function evalExpr(expr, e) {
  try {
    const v = new Function(
      "e", "Math", "wn", "ku", "gi", "Jt", "YP", "Oh", "uy", "GP", "HP", "$P",
      `return (${expr})`,
    )(e, Math, PHF.wn, PHF.ku, PHF.gi, PHF.Jt, PHF.YP, PHF.Oh, PHF.uy, PHF.GP, PHF.HP, PHF.$P);
    return typeof v === "number" ? fmt(Number.isInteger(v) ? v : +v.toFixed(2), 2) : String(v);
  } catch {
    return "?";
  }
}

function evalTemplate(tpl, e) {
  let out = "";
  let i = 0;
  const s = String(tpl || "");
  while (i < s.length) {
    const st = s.indexOf("${", i);
    if (st < 0) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, st);
    let depth = 0;
    let j = st + 2;
    for (; j < s.length; j++) {
      if (s[j] === "{") depth++;
      else if (s[j] === "}") {
        if (depth === 0) break;
        depth--;
      }
    }
    out += evalExpr(s.slice(st + 2, j), e);
    i = j + 1;
  }
  return out || "—";
}

function statText(stat, enh) {
  const m = enh + 1;
  const rows = [];
  if (stat.atk) rows.push(`ATK ${Math.round(stat.atk * m)}`);
  if (stat.def) rows.push(`DEF ${Math.round(stat.def * m)}`);
  if (stat.hp) rows.push(`HP ${Math.round(stat.hp * m)}`);
  if (stat.mp) rows.push(`MP ${Math.round(stat.mp * m)}`);
  return rows.join(" · ") || "스탯 없음";
}

function effectText(effect, enh) {
  if (!effect) return "";
  const raw = effect.formula ? evalTemplate(effect.formula, enh) : (effect.base || "—");
  const targets = effect.targets?.map((t) => TARGET[t] || t).join(", ");
  if (targets && !/자신|아군|적/.test(raw)) return `${raw} (${targets})`;
  return raw;
}

function effectRows(code, levels) {
  const rows = [];
  const item = g.items?.[code] || {};
  const stat = g.equipment_stats?.[code];
  if (stat) rows.push(["장비 스탯", ...levels.map((e) => statText(stat, e))]);
  const rawUse = g.potion_use_effects?.[code];
  const rand = RANDOM_EFFECTS[code];
  const use = rand ? { ...(rawUse || {}), formula: rand.formula, base: rand.base } : rawUse;
  const combat = g.potion_effects?.[code];
  const hasDuration = (g.use_duration || []).includes(code);
  if (use || hasDuration) {
    rows.push(["사용 효과", ...levels.map((e) => {
      const main = effectText(use, e) || "";
      const dur = hasDuration ? ` 지속 ${fmtMinutes(10 * 2 ** e)}` : "";
      return `${main}${dur}`.trim() || "—";
    })]);
  }
  if (combat) rows.push(["전투 효과", ...levels.map((e) => effectText(combat, e))]);
  const gem = g.gem_effects?.[code];
  if (gem) rows.push([`세공: ${gem.name}`, ...levels.map((e) => evalTemplate(gem.desc, e))]);
  if (!rows.length && item.perk) rows.push(["아이템 효과", ...levels.map((e) => evalTemplate(item.perk, e))]);
  if (!rows.length && item.description) rows.push(["설명", ...levels.map(() => item.description)]);
  return rows;
}

function renderSummary(st, res, picked) {
  const summary = $("#summary");
  if (res.error) {
    summary.innerHTML = `<div class="err">${esc(res.error)}</div>`;
    $("#outcomes").innerHTML = "";
    $("#details").innerHTML = "";
    return;
  }
  const item = g.items[st.item1.itemCode];
  const type = TYPE[item.type] || item.type || "기타";
  const rollSuccess = rng([st.item1.id, st.item2.id], "success");
  summary.innerHTML = `
    <div class="item-head">
      <span class="item-ic" id="preview-icon"></span>
      <div>
        <div class="item-name">${esc(item.name || st.item1.itemCode)} <code>${esc(st.item1.itemCode)}</code></div>
        <div class="item-meta">
          <span class="badge">${esc(type)}</span>
          <span class="badge">${esc(st.item1.id)} · ${esc(st.item1.itemKey)}</span>
          <span class="badge">${esc(st.item2.id)} · ${esc(st.item2.itemKey)}</span>
        </div>
      </div>
    </div>
    <div class="metrics">
      <div class="metric buy"><span>강화 성공률</span><b>${pct(res.rates.rate)}</b></div>
      <div class="metric"><span>기본 성공률</span><b>${pct(res.rates.base)}</b></div>
      <div class="metric gold"><span>결과 난수</span><b>${picked.roll.toFixed(6)}</b></div>
      <div class="metric"><span>성공 난수 참고</span><b>${rollSuccess.toFixed(6)}</b></div>
      <div class="metric"><span>판정 솥 강화</span><b>+${res.rates.toolEnh}</b></div>
      <div class="metric ${picked.out.status === "failure" ? "sell" : picked.out.status === "great_success" ? "gold" : "buy"}">
        <span>실제 선택 결과</span><b>${labelStatus(picked.out.status)}</b>
      </div>
    </div>`;
  itemIcon($("#preview-icon"), st.item1.itemCode);
}

function labelStatus(status) {
  if (status === "great_success") return "대성공";
  if (status === "success") return "성공";
  return "실패";
}

function describeItems(items) {
  if (!items.length) return "획득 없음";
  return items.map((it) => {
    const parsed = parseItemKey(it.itemKey);
    const name = parsed ? `${itemName(parsed.itemCode)}+${parsed.enhancement}` : it.itemKey;
    return `${name} (${it.id}${it.originalId ? `, 원본 ${it.originalId}` : ""})`;
  }).join(" · ");
}

function outcomeCard(out, picked) {
  const kind = out.status === "failure" ? "fail" : out.status === "great_success" ? "bonus" : "success";
  return `<article class="outcome ${kind} ${picked ? "pick" : ""}">
    <h3>${labelStatus(out.status)}</h3>
    <p>${esc(describeItems(out.items))}</p>
    <div class="prob"><span>확률</span><b>${pct(out.rate)}</b></div>
    <div class="bar"><span style="width:${Math.max(0, Math.min(100, out.rate * 100))}%"></span></div>
  </article>`;
}

function renderOutcomes(st, res, picked) {
  $("#outcomes").innerHTML = `
    <h2>실제 강화 결과 후보</h2>
    <div class="outcomes">${res.list.map((out) => outcomeCard(out, out === picked.out)).join("")}</div>
    <div class="roll-result">
      결과 ID는 <code>${esc(makeId([st.item1.id, st.item2.id]))}</code> 방식으로 계산됩니다.
      선택된 결과: <b>${esc(describeItems(picked.out.items))}</b>
    </div>`;
}

function renderDetails(st, res) {
  const levels = [...new Set([
    st.item1.enhancement,
    st.item2.enhancement,
    ...res.list.flatMap((out) => out.items.map((it) => parseItemKey(it.itemKey)?.enhancement).filter((e) => e != null)),
  ])].sort((a, b) => a - b);
  const rows = effectRows(st.item1.itemCode, levels);
  const heads = `<th>항목</th>${levels.map((e) => `<th>+${e}</th>`).join("")}`;
  const body = rows.length
    ? rows.map((r) => `<tr>${r.map((v, i) => i === 0 ? `<th>${esc(v)}</th>` : `<td>${esc(v ?? "—")}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${levels.length + 1}" class="muted">강화도에 따라 표시할 스탯이나 효과 데이터가 없습니다.</td></tr>`;
  $("#details").innerHTML = `
    <h2>강화도별 표시값</h2>
    <table class="detail-table"><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table>`;
}

function render() {
  const st = readState();
  const res = outcomes(st);
  if (res.error) return renderSummary(st, res, null);
  const picked = pickOutcome(st, res.list);
  renderSummary(st, res, picked);
  renderOutcomes(st, res, picked);
  renderDetails(st, res);
}

async function init() {
  g = await gamedata();
  $("#item-list").innerHTML = Object.entries(g.items || {})
    .sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0]))
    .map(([code, item]) => `<option value="${esc(code)}">${esc(item.name || code)}</option>`)
    .join("");
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
  render();
}

init().catch((err) => {
  $("#summary").innerHTML = `<div class="err">데이터 로드 실패: ${esc(err.message || err)}</div>`;
});
