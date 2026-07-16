import { CDN } from "./config.js";
import { names } from "./api.js";
import { expToLevel } from "./util.js";

const CONDITION_KR = {
  humid: "습함", poisonous: "유독", fertile: "비옥", arid: "건조",
  toxic: "오염", sunlit: "햇빛", anti_magic: "반마법", poison_immune: "독면역",
};
const GARDEN_DEFAULT_SIDE = 12;
const GARDEN_FIT_MIN_CELL = 8;
const GARDEN_MIN_CELL = 32;
const GARDEN_MAX_CELL = 44;
const GARDEN_GAP = 2;
const GARDEN_PADDING = 2;
const GARDEN_SCROLL_GUTTER = 8;
const GARDEN_VIEW_STORE = "alc_garden_view";
const gardenResizeObservers = new WeakMap();

export function gardenGridLayout(grid, availableWidth = 560, mode = "detail") {
  const safeGrid = Array.isArray(grid) ? grid : [];
  const rows = Math.max(GARDEN_DEFAULT_SIDE, safeGrid.length);
  const cols = safeGrid.reduce(
    (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
    GARDEN_DEFAULT_SIDE,
  );
  const width = Number(availableWidth);
  const usableWidth = Number.isFinite(width) && width > 0 ? width : 560;
  const fitCell = Math.floor(
    (usableWidth - GARDEN_PADDING * 2 - GARDEN_GAP * (cols - 1)) / cols,
  );
  const minCell = mode === "fit" ? GARDEN_FIT_MIN_CELL : GARDEN_MIN_CELL;
  const cellSize = Math.max(minCell, Math.min(GARDEN_MAX_CELL, fitCell));
  return { rows, cols, cellSize };
}

function savedGardenViewMode(availableWidth) {
  try {
    const saved = localStorage.getItem(GARDEN_VIEW_STORE);
    if (saved === "fit" || saved === "detail") return saved;
  } catch {}
  return availableWidth >= 640 ? "fit" : "detail";
}

function saveGardenViewMode(mode) {
  try { localStorage.setItem(GARDEN_VIEW_STORE, mode); } catch {}
}

// 식물 스프라이트 결정: 셀 skinId > 유저 기본스킨 > 기본 스프라이트
function plantSpriteKey(N, plant, defaultSkins) {
  const skinId = plant.skinId || (defaultSkins && defaultSkins[plant.id]);
  if (skinId && N.skins && N.skins[skinId]) return N.skins[skinId];
  const info = N.plants && N.plants[plant.id];
  return (info && info.sprite) || plant.id;
}
// 여러 후보 URL 을 순서대로 시도, 다 실패하면 텍스트 폴백
function loadImg(el, urls, fallback, className) {
  const img = document.createElement("img");
  img.loading = "lazy";
  if (className) img.className = className;
  let i = 0;
  const tryNext = () => {
    if (i >= urls.length) {
      img.remove(); el.classList.add("noimg");
      if (fallback) el.textContent = fallback;
      return;
    }
    img.src = urls[i++];
  };
  img.onerror = tryNext;
  el.appendChild(img);
  tryNext();
  return img;
}
const plantSprites = (k) => [`${CDN}/plants/sprites/${k}.png`];
// 아이템은 타입이 다양(장식/가마솥/재료/씨앗/수확물/포션/도구/장비) → 전 폴더 시도
const ITEM_FOLDERS = [
  "items/ornament", "items/cauldrons", "items/materials", "items/tools",
  "items/equipment", "plants/seeds", "plants/produce", "potions", "",
];
function itemSpriteURLs(key, prefer) {
  const folders = prefer ? [prefer, ...ITEM_FOLDERS.filter((f) => f !== prefer)] : ITEM_FOLDERS;
  return folders.flatMap((f) => {
    const base = f ? `${CDN}/${f}/${key}` : `${CDN}/${key}`;
    return f === "items/ornament" ? [`${base}.png`, `${base}_anim.png`] : [`${base}.png`];
  });
}
// itemFolders 맵으로 정확한 폴더 1곳만 시도 (없으면 전 폴더 폴백)
function itemURLs(N, key) {
  const folder = N.itemFolders && N.itemFolders[key];
  if (folder) return [`${CDN}/${folder}/${key}.png`, `${CDN}/${folder}/${key}_anim.png`];
  return itemSpriteURLs(key);
}

// itemKey 파싱: `code+enh(세공1,세공2)~t` → { code, enh, engravings:[subKey...] }
function parseItemKey(raw) {
  let key = String(raw || "");
  if (key.endsWith("~t")) key = key.slice(0, -2);
  let base = key;
  const engravings = [];
  const p = key.indexOf("(");
  if (p >= 0) {
    base = key.slice(0, p);
    const inner = key.slice(p + 1, key.lastIndexOf(")"));
    let depth = 0, start = 0;
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (c === "," && depth === 0) {
        if (inner.slice(start, i).trim()) engravings.push(inner.slice(start, i).trim());
        start = i + 1;
      }
    }
    if (inner.slice(start).trim()) engravings.push(inner.slice(start).trim());
  }
  const plus = base.indexOf("+");
  const code = plus >= 0 ? base.slice(0, plus) : base;
  const enh = plus >= 0 ? (parseInt(base.slice(plus + 1), 10) || 0) : 0;
  return { code, enh, engravings };
}

function fmt(n) {
  if (n == null) return "-";
  return Number(n).toLocaleString();
}

export async function renderGarden(container, profile, label) {
  const N = await names();
  const grid = profile.grid || [];
  const defaultSkins = profile.defaultPlantSkins || {};
  gardenResizeObservers.get(container)?.disconnect();
  gardenResizeObservers.delete(container);
  container.innerHTML = "";

  // 헤더 요약
  const head = document.createElement("div");
  head.className = "garden-head";
  const cells = grid.flat().filter(Boolean);
  const plants = cells.filter((c) => c.plant);
  head.innerHTML = `
    <h2>🌱 ${label} 의 텃밭</h2>
    <div class="stats">
      <span>거주 <b>${profile.currentZone == null ? "🏘️ 안개마을" : (N.zones?.[profile.currentZone] || profile.currentZone)}</b></span>
      <span>테마 <b>${N.zones?.[profile.activeTheme] || profile.activeTheme || "-"}</b></span>
      <span>경작칸 <b>${cells.length}</b></span>
      <span>식물 <b>${plants.length}</b></span>
      ${profile.exp != null ? `<span>Lv <b>${expToLevel(profile.exp)}</b></span><span>EXP <b>${fmt(profile.exp)}</b></span>` : ""}
      ${profile.totalGoldEarned != null ? `<span>누적골드 <b>${fmt(profile.totalGoldEarned)}</b></span>` : ""}
      ${profile.adventuresCompleted != null ? `<span>모험 <b>${fmt(profile.adventuresCompleted)}</b></span>` : ""}
    </div>`;
  container.appendChild(head);

  // 그리드
  const board = document.createElement("div");
  board.className = "garden-grid";
  let viewMode = savedGardenViewMode(container.clientWidth);
  const { rows, cols, cellSize } = gardenGridLayout(grid, container.clientWidth, viewMode);
  board.dataset.rows = String(rows);
  board.dataset.cols = String(cols);
  board.dataset.cellSize = String(cellSize);
  board.style.setProperty("--garden-cell", `${cellSize}px`);
  board.style.gridTemplateColumns = `repeat(${cols}, var(--garden-cell))`;
  board.style.gridTemplateRows = `repeat(${rows}, var(--garden-cell))`;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = grid[row]?.[col] || null;
      const el = document.createElement("div");
      el.className = "cell";
      if (!cell) { el.classList.add("empty"); board.appendChild(el); continue; }
      el.classList.add("tilled");
      if (cell.conditions?.length) el.dataset.cond = cell.conditions.join(",");

      if (cell.plant) {
        const p = cell.plant;
        const info = N.plants?.[p.id];
        const nm = (info && info.name) || p.id;
        const skinKey = plantSpriteKey(N, p, defaultSkins);
        const baseKey = (info && info.sprite) || p.id;
        const keys = [...new Set([skinKey, baseKey, p.id])];
        const img = loadImg(el, keys.flatMap(plantSprites), nm.slice(0, 2));
        img.alt = nm;
        if (p.enhancement > 0) {
          const b = document.createElement("span");
          b.className = "enh"; b.textContent = `+${p.enhancement}`;
          el.appendChild(b);
        }
        const cond = (cell.conditions || []).concat(p.conditions || [])
          .map((c) => CONDITION_KR[c] || c).join(", ");
        el.title = `${nm}${p.enhancement ? " +" + p.enhancement : ""}\n` +
          `체력 ${p.health ?? "-"} · 누적생산 ${fmt(p.totalProduced)}` +
          (cond ? `\n상태: ${cond}` : "");
      } else if (cell.ornament?.items?.length) {
        el.classList.add("ornament");
        const its = cell.ornament.items;
        const keysOf = (it) => {
          const code = String(it.itemKey || "").split("+")[0];
          const sk = (N.itemSprites && N.itemSprites[code]) || code;
          const variantSk = it.variantId && N.itemVariantSprites?.[it.variantId];
          return { code, keys: [...new Set([variantSk, it.variantId, sk, code].filter(Boolean))] };
        };
        // 베이스(전시대/장식) — 전체 크기
        const b = keysOf(its[0]);
        const img = loadImg(el, b.keys.flatMap((k) => itemURLs(N, k)), "🏵");
        img.alt = el.title = (N.items && N.items[b.code]) || b.code;
        // 전시대 위 전시 아이템(나머지) — 작게 위에
        for (let di = 1; di < its.length; di++) {
          const d = keysOf(its[di]);
          const wrap = document.createElement("span"); wrap.className = "cell-disp";
          loadImg(wrap, d.keys.flatMap((k) => itemURLs(N, k)), "");
          wrap.title = (N.items && N.items[d.code]) || d.code;
          el.appendChild(wrap);
        }
      } else {
        el.title = (cell.conditions || []).map((c) => CONDITION_KR[c] || c).join(", ") || "빈 경작칸";
      }
      board.appendChild(el);
    }
  }
  const boardScroll = document.createElement("div");
  boardScroll.className = "garden-gridscroll";
  boardScroll.tabIndex = 0;
  boardScroll.setAttribute("aria-label", "텃밭 그리드");
  boardScroll.appendChild(board);
  const centerBoard = () => {
    if (!boardScroll.isConnected) return;
    boardScroll.scrollLeft = Math.max(
      0,
      (boardScroll.scrollWidth - boardScroll.clientWidth) / 2,
    );
  };
  // 보기 토글 (평면/입체)
  const isoBtn = document.createElement("button");
  isoBtn.className = "chip garden-iso";
  isoBtn.textContent = "📐 입체 보기";
  isoBtn.onclick = () => {
    const on = board.classList.toggle("iso");
    isoBtn.classList.toggle("active", on);
    isoBtn.textContent = on ? "🔲 평면 보기" : "📐 입체 보기";
    requestAnimationFrame(centerBoard);
  };

  const tools = document.createElement("div");
  tools.className = "garden-view-tools";
  tools.appendChild(isoBtn);

  const modeGroup = document.createElement("div");
  modeGroup.className = "garden-view-modes";
  modeGroup.setAttribute("role", "group");
  modeGroup.setAttribute("aria-label", "텃밭 표시 크기");
  const modeButtons = new Map();
  [
    ["fit", "↔ 전체 보기", "텃밭 전체를 화면 폭에 맞춰 표시"],
    ["detail", "🔎 크게 보기", "칸을 크게 표시하고 좌우로 이동"],
  ].forEach(([mode, text, title]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.title = title;
    button.dataset.mode = mode;
    button.onclick = () => applyViewMode(mode, true);
    modeButtons.set(mode, button);
    modeGroup.appendChild(button);
  });
  tools.appendChild(modeGroup);

  const applyViewMode = (mode, persist = false) => {
    viewMode = mode === "fit" ? "fit" : "detail";
    const availableWidth = Math.max(
      1,
      (boardScroll.clientWidth || container.clientWidth) - GARDEN_SCROLL_GUTTER * 2,
    );
    const layout = gardenGridLayout(grid, availableWidth, viewMode);
    board.dataset.cellSize = String(layout.cellSize);
    board.dataset.viewMode = viewMode;
    board.style.setProperty("--garden-cell", `${layout.cellSize}px`);
    board.classList.toggle("compact", layout.cellSize < 24);
    modeButtons.forEach((button, buttonMode) => {
      const active = buttonMode === viewMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (persist) saveGardenViewMode(viewMode);
    requestAnimationFrame(centerBoard);
  };

  container.appendChild(tools);
  container.appendChild(boardScroll);
  requestAnimationFrame(() => applyViewMode(viewMode));

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => {
      if (!boardScroll.isConnected) {
        observer.disconnect();
        if (gardenResizeObservers.get(container) === observer) {
          gardenResizeObservers.delete(container);
        }
        return;
      }
      applyViewMode(viewMode);
    });
    gardenResizeObservers.set(container, observer);
    observer.observe(container);
  }

  // 시간당 생산량
  if (profile.production?.length) {
    const sec = document.createElement("div");
    sec.className = "info-sec";
    const h3 = document.createElement("h3");
    h3.textContent = "⏱️ 시간당 생산량";
    sec.appendChild(h3);
    const list = document.createElement("div");
    list.className = "kv-list";
    [...profile.production]
      .sort((a, b) => (b.perHour || 0) - (a.perHour || 0))
      .forEach((p) => {
        const code = String(p.itemKey || "").split("+")[0];
        const sk = N.itemSprites?.[code] || code;
        const nm = N.items?.[code] || code;
        const kv = document.createElement("span");
        kv.className = "kv";
        loadImg(kv, itemURLs(N, sk), "", "kv-icon");
        kv.insertAdjacentHTML("beforeend", `${nm} <b>${Math.round(p.perHour).toLocaleString()}/h</b>`);
        list.appendChild(kv);
      });
    sec.appendChild(list);
    container.appendChild(sec);
  }

  // 자동연성 (cauldronRecipeResults) — 포션별 + 강화도별
  if (profile.cauldronRecipeResults?.length) {
    const sec = document.createElement("div");
    sec.className = "info-sec";
    const byItem = {}; // code -> { enh: count }
    for (const r of profile.cauldronRecipeResults) {
      const e = r.enhancement || 0;
      (byItem[r.itemCode] ??= {});
      byItem[r.itemCode][e] = (byItem[r.itemCode][e] || 0) + 1;
    }
    const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    // 강화도별 색 (0=회색 → 고강일수록 진하게)
    const ENH_COLORS = ["#8a88aa", "#4fb286", "#4a90d9", "#f0c14b", "#e8934a", "#e8634a", "#c779e0"];
    const enhColor = (e) => ENH_COLORS[Math.min(e, ENH_COLORS.length - 1)];
    const h3 = document.createElement("h3");
    h3.textContent = `⚗️ 자동연성 (${profile.cauldronRecipeResults.length}개 가마솥)`;
    sec.appendChild(h3);
    const list = document.createElement("div");
    list.className = "brew-list";
    Object.entries(byItem)
      .sort((a, b) => total(b[1]) - total(a[1]))
      .forEach(([code, enh]) => {
        const nm = N.items?.[code] || code;
        const sk = N.itemSprites?.[code] || code;
        const row = document.createElement("div");
        row.className = "brew-row";
        const nameEl = document.createElement("span");
        nameEl.className = "brew-name";
        // itemFolders 맵으로 정확한 폴더 1곳만 (포션/가마솥/재료 등 자동)
        loadImg(nameEl, itemURLs(N, sk), "", "brew-icon");
        nameEl.insertAdjacentHTML("beforeend", `${nm} <em>${total(enh)}</em>`);
        const badgesEl = document.createElement("span");
        badgesEl.className = "brew-badges";
        badgesEl.innerHTML = Object.entries(enh)
          .sort((a, b) => Number(b[0]) - Number(a[0]))
          .map(([e, c]) => {
            const col = enhColor(+e);
            return `<span class="enh-badge" style="color:${col};border-color:${col}66;background:${col}1a">+${e}<i>×${c}</i></span>`;
          }).join("");
        row.appendChild(nameEl);
        row.appendChild(badgesEl);
        list.appendChild(row);
      });
    sec.appendChild(list);
    container.appendChild(sec);
  }

  // 방어파티
  {
    const dp = profile.gardenRaidDefenseParty;
    const sec = document.createElement("div");
    sec.className = "info-sec";
    const ra = profile.raidAvailability;
    const raidTxt = ra ? ` · 약탈가능 ${ra.canRaid ? "O" : "X"}${ra.code ? " (" + ra.code + ")" : ""}` : "";
    const h3 = document.createElement("h3");
    h3.textContent = `🛡️ 방어파티${raidTxt}`;
    sec.appendChild(h3);
    // 구조: { adventurerIds:[...], equipment:{id:{itemKey}}, potions:[{itemKey}] }
    const ids = dp && (Array.isArray(dp) ? dp : dp.adventurerIds);
    if (ids && ids.length) {
      const cards = document.createElement("div");
      cards.className = "adv-cards";
      ids.forEach((x) => {
        const id = typeof x === "string" ? x : (x.id || x.adventurerId || x.unitId || "");
        const nm = N.adventurers?.[id] || id;
        const card = document.createElement("div");
        card.className = "adv-card";
        const head = document.createElement("div");
        head.className = "adv-head";
        loadImg(head, [`${CDN}/npc/adventurer_${id}.png`], "", "adv-portrait");
        head.insertAdjacentHTML("beforeend", `<span class="adv-name">${nm}</span>`);
        card.appendChild(head);
        // 장착 장비 (파티 equipment 우선, 없으면 프로필 전역 adventurerEquipment)
        const eq = (dp.equipment && dp.equipment[id]) ||
                   (profile.adventurerEquipment && profile.adventurerEquipment[id]);
        const eqEl = document.createElement("div");
        eqEl.className = "adv-eq";
        if (eq && eq.itemKey) {
          const pk = parseItemKey(eq.itemKey);
          const sk = N.itemSprites?.[pk.code] || pk.code;
          const enm = N.items?.[pk.code] || pk.code;
          loadImg(eqEl, itemURLs(N, sk), "", "eq-icon");
          eqEl.insertAdjacentHTML("beforeend", `<span>${enm}${pk.enh > 0 ? ` <b>+${pk.enh}</b>` : ""}</span>`);
          card.appendChild(eqEl);
          // 세공
          if (pk.engravings.length) {
            const engEl = document.createElement("div");
            engEl.className = "eq-engr";
            engEl.innerHTML = `<span class="engr-label">세공</span>` + pk.engravings.map((e) => {
              const ek = parseItemKey(e);
              const en = N.items?.[ek.code] || ek.code;
              return `<span class="engr-badge">✦ ${en}${ek.enh > 0 ? ` +${ek.enh}` : ""}</span>`;
            }).join("");
            card.appendChild(engEl);
          }
        } else {
          eqEl.innerHTML = `<span class="muted">장비 없음</span>`;
          card.appendChild(eqEl);
        }
        cards.appendChild(card);
      });
      sec.appendChild(cards);
      // 방어 포션 (문자열 itemKey 배열, 중복은 ×N 으로)
      const pots = dp.potions || [];
      if (pots.length) {
        const counts = {};
        pots.forEach((p) => {
          const key = typeof p === "string" ? p : (p.itemKey || p.itemCode || "");
          if (key) counts[key] = (counts[key] || 0) + 1;
        });
        const prow = document.createElement("div");
        prow.className = "kv-list";
        prow.insertAdjacentHTML("beforeend", `<span class="pot-label">포션</span>`);
        Object.entries(counts).forEach(([key, cnt]) => {
          const code = key.split("+")[0];
          const enh = (key.match(/\+(\d+)/) || [, 0])[1];
          const sk = N.itemSprites?.[code] || code;
          const nm = N.items?.[code] || code;
          const kv = document.createElement("span");
          kv.className = "kv";
          loadImg(kv, itemURLs(N, sk), "", "kv-icon");
          kv.insertAdjacentHTML("beforeend", `${nm}${+enh > 0 ? ` +${enh}` : ""}${cnt > 1 ? ` <b>×${cnt}</b>` : ""}`);
          prow.appendChild(kv);
        });
        sec.appendChild(prow);
      }
    } else {
      const m = document.createElement("div");
      m.innerHTML = `<span class="muted">미설정</span>`;
      sec.appendChild(m);
    }
    container.appendChild(sec);
  }

  // 스킬 레벨
  if (profile.spellLevels && Object.keys(profile.spellLevels).length) {
    const sk = document.createElement("div");
    sk.className = "skills";
    sk.innerHTML = "<h3>🔮 스킬</h3>";
    const list = document.createElement("div");
    list.className = "skill-list";
    for (const [id, lv] of Object.entries(profile.spellLevels)) {
      if (!lv) continue;
      const s = document.createElement("span");
      s.className = "skill";
      loadImg(s, [`${CDN}/skills/${id}.png`], "", "skill-icon");
      s.insertAdjacentHTML("beforeend", `${N.skills?.[id] || id} <b>Lv.${lv}</b>`);
      list.appendChild(s);
    }
    sk.appendChild(list);
    container.appendChild(sk);
  }
}
