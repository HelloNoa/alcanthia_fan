import { api, names, gamedata } from "./api.js";
import { PROXY_BASE, setProxy } from "./config.js";
import { renderGarden } from "./garden.js";
import { renderMarket } from "./market.js";
import { expToLevel } from "./util.js";
import { renderCodex } from "./codex.js";
import { renderSkillTree } from "./skilltree.js";
import { renderCalc } from "./calc.js";
import { renderPlanner } from "./planner.js";
import { renderRandomEffects } from "./random_effects.js";
import { itemIcon } from "./sprites.js";

const view = document.getElementById("view");
const $ = (s, r = document) => r.querySelector(s);
const THEME_STORE = "alc_theme";

function preferredTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORE);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  const btn = $("#theme-toggle");
  if (!btn) return;
  btn.textContent = next === "light" ? "🌙 다크" : "☀️ 화이트";
  btn.title = next === "light" ? "다크 모드로 전환" : "화이트 모드로 전환";
  btn.setAttribute("aria-pressed", next === "light" ? "true" : "false");
}

function mountThemeToggle() {
  const btn = $("#theme-toggle");
  if (!btn) return;
  applyTheme(preferredTheme());
  btn.onclick = () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    try { localStorage.setItem(THEME_STORE, next); } catch {}
    applyTheme(next);
  };
}

function loading() { view.innerHTML = `<div class="loading">불러오는 중…</div>`; }
function error(e) { view.innerHTML = `<div class="err-box">⚠️ ${e.message || e}</div>`; }

// 다른 탭에서 텃밭 보기 요청 (랭킹/거주민 → 텃밭 탭)
let pendingGarden = null;
function openGarden(userId, nickname) {
  pendingGarden = { q: { userId }, label: nickname };
  selectTab("garden");
}

// ---------- 텃밭 탭 (검색 + 뷰어) ----------
async function tabGarden() {
  view.innerHTML = `
    <div class="searchbar">
      <input id="q" placeholder="닉네임 검색 (예: 노아)" autocomplete="off">
      <button id="go">검색</button>
    </div>
    <div id="results" class="results"></div>
    <div id="garden"></div>`;
  const run = async () => {
    const q = $("#q").value.trim();
    if (!q) return;
    const box = $("#results"); box.innerHTML = "검색 중…";
    // 정확한 닉네임으로 바로 열기 (비공개 포함 — friend/profile 은 is_public 무관)
    const direct = document.createElement("button");
    direct.className = "chip direct";
    direct.innerHTML = `🔓 '<b>${q}</b>' 바로 열기`;
    direct.onclick = () => showGarden({ nickname: q }, q);
    try {
      const list = await api.search(q);
      box.innerHTML = "";
      box.appendChild(direct);
      if (list.length) {
        for (const u of list) {
          const b = document.createElement("button");
          b.className = "chip"; b.textContent = u.nickname;
          b.onclick = () => showGarden({ userId: u.user_id }, u.nickname);
          box.appendChild(b);
        }
      } else {
        box.insertAdjacentHTML("beforeend", "<span class='muted'>공개 프로필 검색결과 없음 — 정확한 닉네임이면 위 버튼으로 열기</span>");
      }
    } catch (e) { box.innerHTML = ""; box.appendChild(direct); box.insertAdjacentHTML("beforeend", `<span class="err">${e.message}</span>`); }
  };
  $("#go").onclick = run;
  $("#q").addEventListener("keydown", (e) => e.key === "Enter" && run());
  if (pendingGarden) { showGarden(pendingGarden.q, pendingGarden.label); pendingGarden = null; }
  else $("#q").focus();
}

async function showGarden(query, label) {
  const g = $("#garden") || view;
  g.innerHTML = `<div class="loading">텃밭 불러오는 중…</div>`;
  try {
    const data = await api.garden(query);
    const profile = data.profile || data;
    await renderGarden(g, profile, label || data.nickname || query.nickname || "");
    g.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) { g.innerHTML = `<div class="err-box">⚠️ ${e.message}</div>`; }
}

// ---------- 거래소 탭 ----------
async function tabMarket() {
  const N = await names();
  const opts = Object.entries(N.items || {})
    .map(([k, v]) => `<option value="${k}">${v} (${k})</option>`).join("");
  view.innerHTML = `
    <div class="searchbar">
      <input id="mk" list="items" placeholder="아이템 (예: herb 또는 herb+0)">
      <datalist id="items">${opts}</datalist>
      <button id="mgo">조회</button>
    </div>
    <div id="market"></div>`;
  const run = () => { const k = $("#mk").value.trim(); if (k) renderMarket($("#market"), k); };
  $("#mgo").onclick = run;
  $("#mk").addEventListener("keydown", (e) => e.key === "Enter" && run());
  $("#mk").value = "herb"; run();
}

// ---------- 거주민 탭 ----------
// 존 진행 순서 (= 존 레벨 1~14)
const ZONES = ["beginner_forest", "misty_swamp", "poison_jungle", "mid_cave",
  "starlight_plateau", "advanced_volcano", "wind_corridor", "golden_fields",
  "twilight_valley", "sunset_cliff", "forgotten_fortress", "crystal_mine",
  "sleeping_roots", "dried_spring"];
const RELOCATION_MATERIALS = {
  mist_town: "mana_crystal",
  beginner_forest: "growth_potion",
  misty_swamp: "vitality_elixir",
  poison_jungle: "slime_potion",
  mid_cave: "silver_crystal",
  starlight_plateau: "star_crystal",
  advanced_volcano: "resistance_potion",
  wind_corridor: "gale_potion",
  golden_fields: "golden_crystal",
  twilight_valley: "refraction_potion",
  sunset_cliff: "sunset_glow_potion",
  forgotten_fortress: "forgetting_potion",
  crystal_mine: "refined_crystal",
  sleeping_roots: "dream_potion",
  dried_spring: "mana_potion",
};
function relTime(ts) {
  if (!ts) return "";
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (isNaN(d)) return "";
  if (d < 60) return "방금";
  if (d < 3600) return `${Math.floor(d / 60)}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  return `${Math.floor(d / 86400)}일 전`;
}

async function tabResidents() {
  const N = await names();
  const g = await gamedata();
  const PAGE = 30;
  // 안개마을(중앙 마을)은 zone_id=null 로 조회 (프록시가 mist_town→null 매핑)
  const opts = `<option value="mist_town">🏘️ 안개마을 (마을)</option>` +
    ZONES.map((z, i) => `<option value="${z}">Lv${i + 1} · ${N.zones?.[z] || z}</option>`).join("");
  view.innerHTML = `
    <div class="searchbar">
      <select id="zone">${opts}</select>
      <label class="chk"><input type="checkbox" id="pub" checked> 공개만</label>
    </div>
    <div class="zone-fx" id="zone-fx">
      <div class="zfx-controls">
        <label class="lvlabel">낯익은 터 <input id="zf-fam" type="range" min="0" max="10" value="0"><b id="zf-famv">0</b></label>
        <label class="chk"><input type="checkbox" id="zf-fog"> 안개 해방</label>
        <label class="chk"><input type="checkbox" id="zf-raid"> 습격 방어 보너스</label>
        <span class="zfx-coeff">지역효과 계수 <b id="zf-coeff">0.00</b></span>
      </div>
      <div id="zf-list" class="zfx-list"></div>
      <div id="zf-cost" class="zfx-cost"></div>
    </div>
    <div id="residents"></div>`;

  // 지역 효과 계산 (계수 e = 낯익은터×0.1 + 안개해방×1 + 습격방어보너스×0.5)
  const evalTpl = (tpl, e) => tpl.replace(/\$\{([^}]+)\}/g, (_, x) => {
    try { const v = Number(new Function("e", "Math", "return (" + x + ")")(e, Math)); return isFinite(v) ? v.toFixed(2) : "∞"; }
    catch { return "?"; }
  });
  const renderFx = () => {
    const zone = $("#zone").value;
    const fam = +$("#zf-fam").value, fog = $("#zf-fog").checked ? 1 : 0, raid = $("#zf-raid").checked ? 0.5 : 0;
    const e = fam * 0.1 + fog * 1 + raid;
    $("#zf-coeff").textContent = e.toFixed(2);
    const fx = g.zone_effects?.[zone];
    $("#zf-list").innerHTML = fx
      ? fx.map((t) => `<div class="zfx-item">• ${evalTpl(t, e)}</div>`).join("")
      : `<div class="muted" style="padding:4px 0">표시할 지역 효과 없음 (안개마을 등)</div>`;
    const mat = RELOCATION_MATERIALS[zone];
    const cost = $("#zf-cost");
    cost.innerHTML = `
      <div class="zfx-cost-title">이주 비용</div>
      <div class="zfx-cost-row">
        <span class="zfx-cost-ic" data-ic="engraving_stone"></span>
        <span>확장: 텃밭 각 칸의 강화도와 같은 각인석 1개씩</span>
      </div>
      ${mat ? `<div class="zfx-cost-row">
        <span class="zfx-cost-ic" data-ic="${mat}"></span>
        <span>개간: 텃밭 각 칸의 강화도와 같은 ${N.items?.[mat] || mat} 1개씩</span>
      </div>` : ""}
      <div class="zfx-cost-row muted">
        <span class="zfx-cost-ic" data-ic="levitation_core"></span>
        <span>대체: 최고 필요 강화도 이상 부유핵 1개</span>
      </div>`;
    cost.querySelectorAll(".zfx-cost-ic[data-ic]").forEach((el) => itemIcon(el, el.dataset.ic));
  };
  $("#zf-fam").oninput = () => { $("#zf-famv").textContent = $("#zf-fam").value; renderFx(); };
  $("#zf-fog").onchange = renderFx;
  $("#zf-raid").onchange = renderFx;

  const box = $("#residents");
  let offset = 0;

  const card = (r) => {
    const nick = r.nickname || "익명";
    const uid = r.user_id || r.userId || "";
    const b = document.createElement("button");
    b.className = "res-card";
    b.innerHTML = `
      <span class="res-top"><span class="res-nick">${nick}</span>${
        r.achievement_modifier ? `<span class="title-badge">${r.achievement_modifier}</span>` : ""}</span>
      <span class="res-meta">
        <span class="b ${r.is_public ? "pub" : "pri"}">${r.is_public ? "공개" : "비공개"}</span>
        ${r.is_raidable ? `<span class="b raid">약탈가능</span>` : ""}
        ${r.updated_at ? `<span class="res-time">${relTime(r.updated_at)}</span>` : ""}
      </span>`;
    if (uid) b.onclick = () => openGarden(uid, r.nickname);
    return b;
  };

  const load = async (reset) => {
    const zone = $("#zone").value, pub = $("#pub").checked;
    if (reset) { offset = 0; box.innerHTML = `<div class="loading">불러오는 중…</div>`; }
    try {
      const rows = await api.residents(zone, { limit: PAGE, offset, publicOnly: pub });
      const list = rows.residents || rows || [];
      if (reset) box.innerHTML = "";
      if (!list.length && reset) { box.innerHTML = "<span class='muted'>거주민 없음</span>"; return; }
      let grid = box.querySelector(".res-grid");
      if (!grid) { grid = document.createElement("div"); grid.className = "res-grid"; box.appendChild(grid); }
      list.forEach((r) => grid.appendChild(card(r)));
      box.querySelector(".more")?.remove();
      if (list.length >= PAGE) {
        const more = document.createElement("button");
        more.className = "chip more"; more.textContent = "더보기";
        more.onclick = () => { offset += PAGE; more.remove(); load(false); };
        box.appendChild(more);
      }
    } catch (e) { if (reset) box.innerHTML = `<span class="err">${e.message}</span>`; }
  };

  $("#zone").onchange = () => { renderFx(); load(true); };
  $("#pub").onchange = () => load(true);
  renderFx();
  load(true);
}

// ---------- 랭킹 탭 ----------
const fmt = (n) => Number(n || 0).toLocaleString();
const LB_CATS = [
  { key: "level", label: "🌱 레벨", col: "레벨",
    val: (e) => `Lv ${expToLevel(e.exp)}`, sub: (e) => `${fmt(e.exp)} exp` },
  { key: "gold", label: "💰 골드", col: "누적 골드",
    val: (e) => fmt(e.total_gold_earned), sub: () => "" },
  { key: "adventure", label: "⚔️ 모험", col: "모험 완료",
    val: (e) => `${fmt(e.adventures_completed)}회`,
    sub: (e) => `존 Lv${e.max_zone_level} · 최소 ${e.best_zone_min_turn}턴` },
  { key: "pvp", label: "🏟️ PvP", col: "레이팅",
    val: (e) => `${fmt(e.rating)}`, sub: () => "" },
];

async function tabLeaderboard() {
  loading();
  let d;
  try { d = await api.leaderboard(); } catch (e) { return error(e); }
  const avail = LB_CATS.filter((c) => d[c.key]?.top?.length);
  if (!avail.length) { view.innerHTML = `<pre class="raw">${JSON.stringify(d, null, 2)}</pre>`; return; }

  view.innerHTML = `<h2>🏆 랭킹</h2>
    <nav class="subtabs" id="lbcats">${avail.map((c, i) =>
      `<button data-k="${c.key}" class="${i === 0 ? "active" : ""}">${c.label}</button>`).join("")}</nav>
    <p class="muted">행을 클릭하면 텃밭을 봅니다</p>
    <div id="lbbody"></div>`;

  const renderCat = (key) => {
    const cat = LB_CATS.find((c) => c.key === key);
    const sec = d[key];
    const myId = sec.me?.userId;
    const rows = sec.top.map((e, i) => {
      const uid = e.user_id || "";
      const me = uid && uid === myId;
      const nick = e.nickname || "익명";
      const badge = e.achievement_modifier ? `<span class="title-badge">${e.achievement_modifier}</span>` : "";
      return `<tr class="${me ? "me" : ""}" data-uid="${uid}" data-nick="${e.nickname || ""}">
        <td class="rk">${i + 1}</td>
        <td class="nick">${nick}${badge}</td>
        <td class="val">${cat.val(e)}</td>
        <td class="sub">${cat.sub(e)}</td></tr>`;
    }).join("");
    const body = document.getElementById("lbbody");
    body.innerHTML = `<table class="rank"><thead><tr>
      <th>#</th><th>닉네임</th><th>${cat.col}</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    body.querySelectorAll("tbody tr").forEach((tr) => {
      if (tr.dataset.uid) tr.onclick = () => openGarden(tr.dataset.uid, tr.dataset.nick);
    });
  };

  document.querySelectorAll("#lbcats button").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll("#lbcats button").forEach((x) => x.classList.toggle("active", x === b));
      renderCat(b.dataset.k);
    };
  });
  renderCat(avail[0].key);
}

// ---------- 탭 라우팅 ----------
const TABS = {
  garden: { label: "🌱 텃밭", run: tabGarden },
  planner: { label: "🌿 배치", run: () => renderPlanner(view) },
  market: { label: "💹 거래소", run: tabMarket },
  residents: { label: "🗺️ 거주민", run: tabResidents },
  rank: { label: "🏆 랭킹", run: tabLeaderboard },
  codex: { label: "📖 도감", run: (sub) => renderCodex(view, sub) },
  random: { label: "🎲 확률표", run: () => renderRandomEffects(view) },
  skilltree: { label: "🌳 스킬트리", run: () => renderSkillTree(view) },
  calc: { label: "🧮 계산기", run: (sub) => renderCalc(view, sub) },
};
function mountTabs() {
  const nav = $("#tabs");
  nav.innerHTML = Object.entries(TABS).map(([k, t]) =>
    `<button data-tab="${k}">${t.label}</button>`).join("");
  nav.querySelectorAll("button").forEach((b) =>
    b.onclick = () => selectTab(b.dataset.tab));
}
function selectTab(key) {
  const [main, sub] = key.split("/");   // "calc/adv" → 메인 탭 + 서브탭(새로고침 유지)
  location.hash = key;
  $("#tabs").querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === main));
  (TABS[main] || TABS.garden).run(sub);
}

// 프록시 주소 표시/변경
function mountProxyBadge() {
  const el = $("#proxy");
  el.textContent = PROXY_BASE;
  el.onclick = () => {
    const v = prompt("프록시 주소", PROXY_BASE);
    if (v) setProxy(v);
  };
}

mountTabs();
mountThemeToggle();
mountProxyBadge();
selectTab((location.hash || "#garden").slice(1));
