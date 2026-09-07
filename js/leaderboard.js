import { expToLevel } from "./util.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const numeric = (value) => {
  if (value == null || (typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const formatNumber = (value) => numeric(value)?.toLocaleString("ko-KR") ?? "—";

// Official leaderboard (2026-09-08): PPM / 1e6, two decimals; this is
// accumulated weekly share, not a percentage and not capped at 1.00.
export function formatLeylineRecovery(value) {
  const ppm = numeric(value);
  return ppm === null ? "—" : (ppm / 1e6).toFixed(2);
}

export function formatAdventureRecord(entry, zones = {}) {
  const level = numeric(entry.max_zone_level);
  if (level === 0) return "완료 기록 없음";
  if (level === null || !Number.isInteger(level)) return "—";
  // Both the official client and gamedata use zone definition order for levels.
  const name = Object.values(zones)[level - 1]?.name || `지역 Lv.${level}`;
  const difficulty = numeric(entry.best_zone_difficulty);
  const nightmare = difficulty === null ? " (난이도 미확인)" : difficulty > 0
    ? ` (악몽 ${["", "Ⅰ", "Ⅱ", "Ⅲ"][difficulty] ?? difficulty})` : "";
  return `${name}${nightmare} · ${formatNumber(entry.best_zone_min_turn)}턴`;
}

export const LEADERBOARD_CATEGORIES = Object.freeze([
  {
    key: "leyline", label: "🌿 지맥 회복", column: "누적 지분",
    description: "맥 회복 주간 경쟁 · 매주 월요일 09시에 지난주 지분이 확정됩니다. 한 주의 전체 지분 1.00을 기여도에 따라 나누며, 순위에는 매주 확정된 지분의 누적 합계를 표시합니다.",
    value: (entry) => formatLeylineRecovery(entry.leyline_recovery_ppm),
    detail: () => "",
  },
  {
    key: "level", label: "🌱 레벨", column: "레벨",
    description: "누적 경험치에 따른 마녀 레벨 순위입니다.",
    value: (entry) => numeric(entry.exp) === null ? "—" : `Lv ${expToLevel(entry.exp)}`,
    detail: (entry) => `${formatNumber(entry.exp)} EXP`,
  },
  {
    key: "gold", label: "💰 누적 골드", column: "누적 골드",
    description: "상점 판매 골드 + 시장 판매 총액(수수료 차감 전) 기준입니다. 우편·물물교환은 제외됩니다.",
    // Do not fall back to total_gold_earned: it omits gross market sales.
    value: (entry) => formatNumber(entry.leaderboard_gold_earned),
    detail: () => "",
  },
  {
    key: "adventure", label: "⚔️ 모험", column: "최고 모험 기록",
    description: "완료 지역이 높은 순 → 악몽 단계가 높은 순 → 완료 턴이 적은 순입니다. 누적 완료 횟수는 참고 정보입니다.",
    value: formatAdventureRecord,
    detail: (entry) => `누적 완료 ${formatNumber(entry.adventures_completed)}회`,
  },
].map(Object.freeze));

export function renderLeaderboardCategory(key, data, zones = {}) {
  const category = LEADERBOARD_CATEGORIES.find((entry) => entry.key === key);
  if (!category) return "";
  const description = `<p class="muted rank-description">${escapeHtml(category.description)}</p>`;
  const top = data?.[key]?.top;
  if (!Array.isArray(top)) return `${description}<p class="muted" role="status">이 항목의 랭킹 데이터를 제공하지 않습니다.</p>`;
  // Keep the server's ranking order; sorting by displayed values would be wrong.
  const rows = top.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const nickname = entry.nickname || "익명";
    const badge = entry.achievement_modifier
      ? `<span class="title-badge">${escapeHtml(entry.achievement_modifier)}</span>` : "";
    const name = entry.user_id
      ? `<button type="button" class="rank-user" data-uid="${escapeHtml(entry.user_id)}" data-nick="${escapeHtml(entry.nickname || "")}" aria-label="${escapeHtml(nickname)} 텃밭 보기">${escapeHtml(nickname)}</button>`
      : escapeHtml(nickname);
    const detail = category.detail(entry);
    // Proxy 'me' belongs to the proxy's account, not the fan-page visitor.
    return [`<tr><td class="rk">${index + 1}</td><td class="nick">${name}${badge}</td>
      <td class="val">${escapeHtml(category.value(entry, zones))}${detail ? `<div class="sub">${escapeHtml(detail)}</div>` : ""}</td></tr>`];
  }).join("");
  if (!rows) return `${description}<p class="muted" role="status">아직 등록된 순위가 없습니다.</p>`;
  return `${description}<div class="rank-table-scroll" role="region" aria-label="${escapeHtml(category.column)} 순위표" tabindex="0">
    <table class="rank"><thead><tr><th scope="col">순위</th><th scope="col">닉네임</th><th scope="col">${escapeHtml(category.column)}</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

export function renderLeaderboard(view, data, gameData, onUserClick) {
  view.innerHTML = `<h2>🏆 랭킹</h2>
    <nav class="subtabs" id="lbcats" aria-label="랭킹 종류">${LEADERBOARD_CATEGORIES.map(({ key, label }) =>
      `<button type="button" data-k="${key}" aria-pressed="false">${label}</button>`).join("")}</nav>
    <p class="muted">공개 상위 순위 · 닉네임을 누르면 텃밭을 봅니다.</p>
    <div id="lbbody"></div>`;
  const body = view.querySelector("#lbbody");
  const buttons = [...view.querySelectorAll("#lbcats button")];
  const selectCategory = (key) => {
    buttons.forEach((button) => {
      const active = button.dataset.k === key;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    body.innerHTML = renderLeaderboardCategory(key, data, gameData?.zones);
    body.querySelectorAll(".rank-user").forEach((button) => {
      button.onclick = () => onUserClick(button.dataset.uid, button.dataset.nick);
    });
  };
  buttons.forEach((button) => { button.onclick = () => selectCategory(button.dataset.k); });
  selectCategory("leyline");
}
