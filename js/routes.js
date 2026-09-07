export const SITE_NAV_ITEMS = Object.freeze([
  { key: "garden", label: "🌱 텃밭" },
  { key: "watch", label: "🛡️ 이끼제리 방범대" },
  { key: "planner", label: "🌿 배치" },
  { key: "market", label: "💹 거래소" },
  { key: "residents", label: "🗺️ 거주민" },
  { key: "rank", label: "🏆 랭킹" },
  { key: "quests", label: "📋 의뢰" },
  { key: "codex", label: "📖 도감" },
  { key: "random", label: "🎲 확률표" },
  { key: "skilltree", label: "🌳 스킬트리" },
  { key: "calc", label: "🧮 계산기" },
  { key: "patch-notes", label: "📢 패치내역" },
].map((item) => Object.freeze(item)));

export const CALC_ROUTE_KEYS = Object.freeze(["brew", "time", "level", "ev", "adv", "raid"]);
export const QUEST_ROUTE_KEYS = Object.freeze(["goals", "required", "none", "daily", "weekly", "all"]);
export const CALC_DEFAULT_ROUTE_KEY = "brew";
export const QUEST_DEFAULT_ROUTE_KEY = "daily";
export const CODEX_STATIC_ROUTE_KEYS = Object.freeze(["plants", "potions", "skills", "monsters", "adventurers", "items"]);
export const CODEX_APP_ROUTE_KEYS = Object.freeze(["achievements", "transmute"]);

const TOP_LEVEL_APP_ROUTES = SITE_NAV_ITEMS
  .map(({ key }) => key)
  .filter((key) => key !== "codex");

export const APP_ROUTE_ENTRIES = Object.freeze([
  ...TOP_LEVEL_APP_ROUTES.map((route) => ({ path: route, route })),
  ...CALC_ROUTE_KEYS
    .filter((key) => key !== CALC_DEFAULT_ROUTE_KEY)
    .map((key) => ({ path: `calc/${key}`, route: `calc/${key}` })),
  ...QUEST_ROUTE_KEYS
    .filter((key) => key !== QUEST_DEFAULT_ROUTE_KEY)
    .map((key) => ({ path: `quests/${key}`, route: `quests/${key}` })),
  ...CODEX_APP_ROUTE_KEYS.map((key) => ({ path: key, route: `codex/${key}` })),
].map((entry) => Object.freeze(entry)));

export function routePath(route) {
  const [main, sub] = String(route || "").split("/");
  if (main === "codex") {
    const category = [...CODEX_STATIC_ROUTE_KEYS, ...CODEX_APP_ROUTE_KEYS].includes(sub) ? sub : "plants";
    return `${category}/`;
  }
  if (main === "calc") {
    return sub && CALC_ROUTE_KEYS.includes(sub) && sub !== CALC_DEFAULT_ROUTE_KEY ? `calc/${sub}/` : "calc/";
  }
  if (main === "quests") {
    return sub && QUEST_ROUTE_KEYS.includes(sub) && sub !== QUEST_DEFAULT_ROUTE_KEY ? `quests/${sub}/` : "quests/";
  }
  if (TOP_LEVEL_APP_ROUTES.includes(main)) return `${main}/`;
  return "garden/";
}

export function routeHref(route) {
  return `./${routePath(route)}`;
}

export function legacyRouteFromHash(hash = "") {
  const raw = String(hash).replace(/^#/, "");
  if (!raw) return null;

  for (const prefix of ["p/", "planner/plan/"]) {
    if (!raw.startsWith(prefix)) continue;
    const encoded = raw.slice(prefix.length);
    let plan = encoded;
    try { plan = decodeURIComponent(encoded); } catch {}
    return { route: "planner", plan };
  }

  const [main, sub] = raw.split("/");
  if (main === "codex") {
    if ([...CODEX_STATIC_ROUTE_KEYS, ...CODEX_APP_ROUTE_KEYS].includes(sub)) return { route: `codex/${sub}` };
    return { route: "codex/plants" };
  }
  if (main === "calc") return { route: sub && CALC_ROUTE_KEYS.includes(sub) ? `calc/${sub}` : "calc" };
  if (main === "quests") return { route: sub && QUEST_ROUTE_KEYS.includes(sub) ? `quests/${sub}` : "quests" };
  if (TOP_LEVEL_APP_ROUTES.includes(main)) return { route: main };
  return null;
}
