import { PROXY_BASE } from "./config.js";

async function get(path, params) {
  const url = new URL(PROXY_BASE + path);
  if (params) for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.detail || j.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  garden:     (q) => get("/", q.userId ? { userId: q.userId } : { nickname: q.nickname }),
  search:     (q) => get("/search", { q, limit: 20 }),
  residents:  (zoneId, opts = {}) => get("/residents", { zoneId, ...opts }),
  leaderboard:() => get("/leaderboard"),
  price:      (itemKey) => get("/price", { itemKey }),
  orderbook:  (itemKey, limit = 12) => get("/orderbook", { itemKey, limit }),
  candles:    (itemKey, interval = "1d", limit = 30) => get("/candles", { itemKey, interval, limit }),
  browse:     (opts = {}) => get("/browse", { sort: "orders", limit: 30, ...opts }),
  version:    () => get("/version"),
};

// 라벨용 이름 맵 (한 번 로드)
let _names = null;
export async function names() {
  if (_names) return _names;
  try { _names = await (await fetch("./data/names.json")).json(); }
  catch { _names = { plants: {}, items: {}, skills: {}, zones: {} }; }
  return _names;
}

// 전체 게임데이터 (도감/계산기/스킬트리용)
let _gd = null;
export async function gamedata() {
  if (_gd) return _gd;
  try { _gd = await (await fetch("./data/gamedata.json")).json(); }
  catch { _gd = {}; }
  return _gd;
}
