import { APP_ROUTE_ENTRIES, SITE_NAV_ITEMS, routeHref } from "../js/routes.js";
import { renderPatchNotesContent } from "./patch-notes-page.mjs";

const SITE_ROOT = "https://hellonoa.github.io/alcanthia_fan/";
const OFFICIAL_SITE = "https://www.alcanthia.com/";
const HOME_TITLE = "알칸시아 공략·도감·계산기 | 이끼제리 팬페이지";
const HOME_DESCRIPTION = "알칸시아 작물·포션·스킬·몬스터·모험가 도감과 텃밭 배치, 스킬트리, 계산기를 제공하는 비공식 팬페이지입니다.";

const ROUTE_METADATA = Object.freeze({
  "patch-notes": {
    title: "알칸시아 패치내역·업데이트 | 이끼제리 팬페이지",
    heading: "알칸시아 패치내역",
    description: "알칸시아 공식 본서버의 업데이트와 오류 수정 내역을 날짜별로 확인하고 검색할 수 있는 비공식 팬페이지입니다.",
    indexable: true,
  },
  garden: {
    title: "알칸시아 텃밭 조회 | 이끼제리 팬페이지",
    heading: "알칸시아 텃밭 조회",
    description: "알칸시아 공개 프로필의 텃밭 배치와 작물, 강화 상태를 닉네임 또는 유저 ID로 조회하는 팬 도구입니다.",
    indexable: false,
  },
  watch: {
    title: "이끼제리 방범대 안내 | 알칸시아 팬페이지",
    heading: "이끼제리 방범대",
    description: "알칸시아 커뮤니티의 반복적인 비매너 행위 제보 기준과 익명 제보 절차를 안내합니다.",
    indexable: false,
  },
  planner: {
    title: "알칸시아 텃밭 배치 시뮬레이터 | 이끼제리 팬페이지",
    heading: "알칸시아 텃밭 배치 시뮬레이터",
    description: "알칸시아 텃밭의 작물과 시설을 배치하고 생산량, 수분과 꽃가루 효과를 미리 계산하는 배치 도구입니다.",
    indexable: true,
  },
  market: {
    title: "알칸시아 거래소 시세 조회 | 이끼제리 팬페이지",
    heading: "알칸시아 거래소 시세 조회",
    description: "알칸시아 아이템별 실시간 거래소 시세와 매수·매도 호가를 조회하는 팬 도구입니다.",
    indexable: false,
  },
  residents: {
    title: "알칸시아 지역별 거주민 조회 | 이끼제리 팬페이지",
    heading: "알칸시아 지역별 거주민",
    description: "알칸시아 각 지역의 공개 거주민 목록과 지역 효과, 이주 재료를 확인하는 팬 도구입니다.",
    indexable: false,
  },
  rank: {
    title: "알칸시아 랭킹 조회 | 이끼제리 팬페이지",
    heading: "알칸시아 랭킹 조회",
    description: "알칸시아 공개 랭킹에서 레벨, 골드, 모험과 PvP 순위를 확인하는 팬 도구입니다.",
    indexable: false,
  },
  quests: {
    title: "알칸시아 일간 의뢰·보상 목록 | 이끼제리 팬페이지",
    heading: "알칸시아 일간 의뢰",
    description: "알칸시아 일간 의뢰의 요청 아이템, 보상, 의뢰인과 선행 조건을 확인할 수 있는 공략 자료입니다.",
    indexable: true,
  },
  random: {
    title: "알칸시아 랜덤 효과·확률표 | 이끼제리 팬페이지",
    heading: "알칸시아 랜덤 효과 확률표",
    description: "알칸시아 아이템과 효과의 무작위 결과, 등장 확률과 관련 정보를 확인할 수 있는 공략 자료입니다.",
    indexable: true,
  },
  skilltree: {
    title: "알칸시아 스킬트리 시뮬레이터 | 이끼제리 팬페이지",
    heading: "알칸시아 스킬트리 시뮬레이터",
    description: "알칸시아 마녀 스킬의 선행 관계와 필요 포인트를 확인하고 원하는 빌드를 구성하는 스킬트리 도구입니다.",
    indexable: true,
  },
  calc: {
    title: "알칸시아 포션 양조 조합표 | 이끼제리 팬페이지",
    heading: "알칸시아 포션 양조 조합표",
    description: "알칸시아 양조 재료 두 개를 조합했을 때 만들어지는 포션을 한눈에 확인할 수 있는 조합표입니다.",
    indexable: true,
  },
  "calc/time": {
    title: "알칸시아 작물·포션·강화 시간 계산기 | 이끼제리 팬페이지",
    heading: "알칸시아 시간 계산기",
    description: "알칸시아 작물 성장, 포션 양조와 아이템 강화 시간을 숙련도, 강화도와 지역 효과에 따라 계산합니다.",
    indexable: true,
  },
  "calc/level": {
    title: "알칸시아 레벨 경험치 계산기 | 이끼제리 팬페이지",
    heading: "알칸시아 레벨 계산기",
    description: "알칸시아의 현재 레벨과 목표 레벨을 기준으로 필요한 경험치와 진행도를 계산합니다.",
    indexable: true,
  },
  "calc/ev": {
    title: "알칸시아 강화 기댓값 계산기 | 이끼제리 팬페이지",
    heading: "알칸시아 강화 기댓값 계산기",
    description: "알칸시아 아이템 강화에 필요한 재료 수량과 비용의 기댓값을 강화 조건별로 계산합니다.",
    indexable: true,
  },
  "calc/adv": {
    title: "알칸시아 모험 시뮬레이터 | 이끼제리 팬페이지",
    heading: "알칸시아 모험 시뮬레이터",
    description: "알칸시아 모험가 파티, 장비와 포션을 설정해 지역별 전투 결과와 승률을 계산합니다.",
    indexable: true,
  },
  "calc/raid": {
    title: "알칸시아 습격 시뮬레이터 | 이끼제리 팬페이지",
    heading: "알칸시아 습격 시뮬레이터",
    description: "알칸시아 공격·방어 파티 조건을 설정해 습격 전투 흐름과 예상 승률을 계산합니다.",
    indexable: true,
  },
  "quests/goals": {
    title: "알칸시아 진행 목표 목록 | 이끼제리 팬페이지",
    heading: "알칸시아 진행 목표",
    description: "알칸시아 초반부터 이어지는 진행 목표의 순서, 수행 위치와 보상을 검색해 확인할 수 있습니다.",
    indexable: true,
  },
  "quests/required": {
    title: "알칸시아 필수 진행 목표 목록 | 이끼제리 팬페이지",
    heading: "알칸시아 필수 진행 목표",
    description: "알칸시아 진행에 필요한 필수 목표만 모아 순서, 수행 위치와 보상을 확인할 수 있습니다.",
    indexable: true,
  },
  "quests/none": {
    title: "알칸시아 일회성 의뢰 목록 | 이끼제리 팬페이지",
    heading: "알칸시아 일회성 의뢰",
    description: "알칸시아 일회성 의뢰의 요청 아이템, 보상, 의뢰인과 선행 조건을 확인할 수 있습니다.",
    indexable: true,
  },
  "quests/weekly": {
    title: "알칸시아 주간 의뢰·보상 목록 | 이끼제리 팬페이지",
    heading: "알칸시아 주간 의뢰",
    description: "알칸시아 주간 의뢰의 요청 아이템, 보상, 의뢰인과 선행 조건을 확인할 수 있습니다.",
    indexable: true,
  },
  "quests/all": {
    title: "알칸시아 전체 의뢰·보상 목록 | 이끼제리 팬페이지",
    heading: "알칸시아 전체 의뢰",
    description: "알칸시아 일회성, 일간과 주간 의뢰의 요청 아이템, 보상과 선행 조건을 한곳에서 확인할 수 있습니다.",
    indexable: true,
  },
  "codex/achievements": {
    title: "알칸시아 업적 도감·보상 | 이끼제리 팬페이지",
    heading: "알칸시아 업적 도감",
    description: "알칸시아 업적의 달성 조건, 단계별 요구량과 공개된 보상을 확인할 수 있는 비공식 업적 도감입니다.",
    indexable: true,
  },
  "codex/transmute": {
    title: "알칸시아 변성 도감·계산기 | 이끼제리 팬페이지",
    heading: "알칸시아 변성 도감",
    description: "알칸시아 아이템 변성 규칙과 재료, 강화 결과를 확인하고 예상 결과를 계산할 수 있는 비공식 자료입니다.",
    indexable: true,
  },
});

const CALC_ROUTES = Object.freeze(["calc", "calc/time", "calc/level", "calc/ev", "calc/adv", "calc/raid"]);
const QUEST_ROUTES = Object.freeze(["quests", "quests/goals", "quests/required", "quests/none", "quests/weekly", "quests/all"]);
const CODEX_ROUTES = Object.freeze(["codex/achievements", "codex/transmute"]);
const TOOL_ROUTES = Object.freeze(["planner", "random", "skilltree", "calc", "quests"]);
const LIVE_ROUTES = Object.freeze(["garden", "market", "residents", "rank", "watch"]);

export { APP_ROUTE_ENTRIES };

export const APP_ROUTE_DEFINITIONS = Object.freeze(APP_ROUTE_ENTRIES.map((entry) => {
  const metadata = ROUTE_METADATA[entry.route];
  if (!metadata) throw new Error(`앱 경로 SEO 정의가 없습니다: ${entry.route}`);
  return Object.freeze({
    ...entry,
    ...metadata,
    canonical: `${SITE_ROOT}${entry.path}/`,
  });
}));

export const INDEXABLE_APP_ROUTE_DEFINITIONS = Object.freeze(
  APP_ROUTE_DEFINITIONS.filter(({ indexable }) => indexable),
);

const DEFINITION_BY_ROUTE = new Map(APP_ROUTE_DEFINITIONS.map((definition) => [definition.route, definition]));

export function renderAppRoutePage(definition, homepageHtml, { patchNotes } = {}) {
  if (!definition?.title || !definition?.description || !definition?.canonical) {
    throw new Error(`완전하지 않은 앱 경로 SEO 정의: ${definition?.route || "알 수 없음"}`);
  }
  const depth = definition.path.split("/").filter(Boolean).length;
  const baseHref = "../".repeat(depth);
  const robots = definition.indexable ? "index,follow" : "noindex,follow";
  const structuredData = serializeJsonLd({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${definition.canonical}#webpage`,
    name: definition.title,
    url: definition.canonical,
    inLanguage: "ko-KR",
    description: definition.description,
    isPartOf: { "@id": `${SITE_ROOT}#website` },
    about: {
      "@type": "VideoGame",
      name: "알칸시아",
      url: OFFICIAL_SITE,
    },
  });

  return homepageHtml
    .replace("<head>", `<head>\n  <base href="${baseHref}">`)
    .replace(`<title>${HOME_TITLE}</title>`, `<title>${escapeHtml(definition.title)}</title>`)
    .replace(
      `<meta name="description" content="${HOME_DESCRIPTION}">`,
      `<meta name="description" content="${escapeAttribute(definition.description)}">`,
    )
    .replace(
      `<link rel="canonical" href="${SITE_ROOT}">`,
      `<meta name="robots" content="${robots}">\n  <link rel="canonical" href="${escapeAttribute(definition.canonical)}">`,
    )
    .replace(`<meta property="og:title" content="${HOME_TITLE}">`, `<meta property="og:title" content="${escapeAttribute(definition.title)}">`)
    .replace(`<meta property="og:description" content="${HOME_DESCRIPTION}">`, `<meta property="og:description" content="${escapeAttribute(definition.description)}">`)
    .replace(`<meta property="og:url" content="${SITE_ROOT}">`, `<meta property="og:url" content="${escapeAttribute(definition.canonical)}">`)
    .replace(`<meta name="twitter:title" content="${HOME_TITLE}">`, `<meta name="twitter:title" content="${escapeAttribute(definition.title)}">`)
    .replace(`<meta name="twitter:description" content="${HOME_DESCRIPTION}">`, `<meta name="twitter:description" content="${escapeAttribute(definition.description)}">`)
    .replace(
      /\n  <script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `\n  <script type="application/ld+json">${structuredData}</script>`,
    )
    .replace("<body data-route=\"garden\">", `<body class="app-route-page" data-route="${definition.route}">`)
    .replace('<nav id="tabs" class="site-tabs" aria-label="주요 메뉴"></nav>',
      definition.route === "patch-notes"
        ? `<nav id="tabs" class="site-tabs" aria-label="주요 메뉴">${SITE_NAV_ITEMS.map(({ key, label }) => `<a href="${routeHref(key)}"${key === "patch-notes" ? ' class="active" aria-current="page"' : ""}>${label}</a>`).join("")}</nav>`
        : '<nav id="tabs" class="site-tabs" aria-label="주요 메뉴"></nav>')
    .replace('<main id="view"></main>', definition.route === "patch-notes" ? renderPatchNotesContent(patchNotes) : renderStaticRouteContent(definition))
    .replace(/\n  <section class="home-seo-intro"[\s\S]*?<\/section>/, "");
}

function renderStaticRouteContent(definition) {
  const relatedRoutes = relatedRoutesFor(definition.route)
    .filter((route) => route !== definition.route)
    .slice(0, 6);
  const relatedLinks = relatedRoutes.map((route) => {
    const related = DEFINITION_BY_ROUTE.get(route);
    if (!related) return "";
    return `<a href="${escapeAttribute(routeHref(route))}">${escapeHtml(related.heading)}</a>`;
  }).filter(Boolean).join("\n        ");

  return `<main id="view">
    <section class="route-seo-fallback" aria-labelledby="route-seo-title">
      <p class="seo-eyebrow">알칸시아 공략 자료</p>
      <h1 id="route-seo-title">${escapeHtml(definition.heading)}</h1>
      <p>${escapeHtml(definition.description)}</p>
      ${relatedLinks ? `<nav aria-label="관련 알칸시아 자료">\n        ${relatedLinks}\n      </nav>` : ""}
      <p class="muted">대화형 기능을 불러오는 중입니다.</p>
    </section>
  </main>`;
}

function relatedRoutesFor(route) {
  if (route === "calc" || route.startsWith("calc/")) return CALC_ROUTES;
  if (route === "quests" || route.startsWith("quests/")) return QUEST_ROUTES;
  if (route.startsWith("codex/")) return [...CODEX_ROUTES, "random", "skilltree"];
  if (TOOL_ROUTES.includes(route)) return TOOL_ROUTES;
  return LIVE_ROUTES;
}

function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
