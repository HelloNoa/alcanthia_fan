const SITE_ROOT = "https://hellonoa.github.io/alcanthia_fan/";
const OFFICIAL_SITE = "https://www.alcanthia.com/";

export const SEO_PAGE_DEFINITIONS = Object.freeze([
  {
    slug: "plants",
    category: "plants",
    title: "알칸시아 작물 도감·성장 시간 | 이끼제리 팬페이지",
    heading: "알칸시아 작물 도감",
    description: "알칸시아 작물의 성장 시간, 수명, 생산 주기, 생산물과 특수 효과를 확인할 수 있는 비공식 작물 도감입니다.",
    intro: "작물별 성장 시간과 수명, 생산 주기, 수확물과 특수 효과를 한눈에 확인할 수 있습니다.",
  },
  {
    slug: "potions",
    category: "potions",
    title: "알칸시아 포션 효과·조합 도감 | 이끼제리 팬페이지",
    heading: "알칸시아 포션 도감",
    description: "알칸시아 포션의 효과, 사용 정보와 공개된 재료 조합을 확인할 수 있는 비공식 포션 도감입니다.",
    intro: "포션의 양조 시간과 재료 조합, 사용 효과와 전투 효과를 확인할 수 있습니다.",
  },
  {
    slug: "skills",
    category: "skills",
    title: "알칸시아 스킬 도감·선행 조건 | 이끼제리 팬페이지",
    heading: "알칸시아 스킬 도감",
    description: "알칸시아 마녀 스킬의 계열, 최대 레벨, 효과와 선행 조건을 확인할 수 있는 비공식 스킬 도감입니다.",
    intro: "마녀 스킬의 계열과 최대 레벨, 효과, 선행 스킬 조건을 확인할 수 있습니다.",
  },
  {
    slug: "monsters",
    category: "monsters",
    title: "알칸시아 몬스터 도감·지역 정보 | 이끼제리 팬페이지",
    heading: "알칸시아 몬스터 도감",
    description: "알칸시아 지역별 몬스터의 HP, ATK, DEF, MP와 스킬을 확인할 수 있는 비공식 몬스터 도감입니다.",
    intro: "지역별 몬스터의 HP, ATK, DEF, MP와 보유 스킬 정보를 확인할 수 있습니다.",
  },
  {
    slug: "adventurers",
    category: "adventurers",
    title: "알칸시아 모험가 도감·스탯·스킬 | 이끼제리 팬페이지",
    heading: "알칸시아 모험가 도감",
    description: "알칸시아 모험가의 역할, 등급, 스탯, MP와 스킬을 확인할 수 있는 비공식 모험가 도감입니다.",
    intro: "모험가별 역할과 등급, 고용 비용, 기본 스탯과 보유 스킬을 확인할 수 있습니다.",
  },
  {
    slug: "items",
    category: "items",
    title: "알칸시아 아이템 도감·획득처 | 이끼제리 팬페이지",
    heading: "알칸시아 아이템 도감",
    description: "알칸시아 아이템의 분류, 제작 시간, 획득처와 사용처를 확인할 수 있는 비공식 아이템 도감입니다.",
    intro: "아이템의 분류와 제작 시간, 공개된 획득처와 제작·양조 사용처를 확인할 수 있습니다.",
  },
].map((definition) => Object.freeze({
  ...definition,
  canonical: `${SITE_ROOT}${definition.slug}/`,
})));

const CATEGORY_LABELS = Object.freeze({
  plants: "작물",
  potions: "포션",
  skills: "스킬",
  monsters: "몬스터",
  adventurers: "모험가",
  items: "아이템",
});

const ITEM_TYPES = Object.freeze({
  seed: "씨앗",
  produce: "수확물",
  potion: "포션",
  equipment: "장비",
  tool: "도구",
  general: "일반",
});

const SKILL_TREES = Object.freeze({
  farming: "재배",
  brewing: "연성",
  mana: "마나",
  contract: "계약",
  harvest: "수확",
  growth: "성장",
  crafting: "제작",
});

const ADVENTURER_ROLES = Object.freeze({
  dealer: "딜러",
  nuker: "마법 딜러",
  tank: "탱커",
  support: "서포터",
  healer: "힐러",
});

const TARGET_LABELS = Object.freeze({
  self: "자신",
  enemy_one: "적 단일",
  enemy_all: "적 전체",
  ally_one: "아군",
  ally_all: "아군 전체",
});

const EXTRA_TEST_ITEMS = new Set(["growth_elixir", "poison_fang"]);
const ITEM_TAB_POTIONS = new Set(["condensing_flask"]);

export function isExcludedEntry(code, entry, gameData = {}) {
  return new Set(gameData.test_items || []).has(code)
    || EXTRA_TEST_ITEMS.has(code)
    || /^aging_/.test(code)
    || entry?.test === true
    || String(entry?.name || "").includes("시험용");
}

export function renderSeoPage(definition, gameData, names) {
  assertDefinition(definition);
  const context = createContext(gameData || {}, names || {});
  const cards = renderCategory(definition.category, context);
  const navigation = SEO_PAGE_DEFINITIONS.map((page) =>
    `<a${page.slug === definition.slug ? ' aria-current="page"' : ""} href="../${escapeAttribute(page.slug)}/">${escapeHtml(CATEGORY_LABELS[page.category])} 도감</a>`
  ).join("\n        ");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(definition.title)}</title>
  <meta name="description" content="${escapeAttribute(definition.description)}">
  <link rel="canonical" href="${escapeAttribute(definition.canonical)}">
  <link rel="icon" type="image/png" href="../favicon.png">
  <link rel="apple-touch-icon" href="../favicon.png">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body class="seo-page">
  <header class="seo-site-header">
    <a class="seo-brand" href="../"><img src="../favicon.png" alt="">이끼제리 팬페이지</a>
    <span>알칸시아 비공식 팬 제작</span>
  </header>
  <nav class="seo-breadcrumb" aria-label="현재 위치">
    <a href="../">홈</a><span aria-hidden="true">/</span><span>${escapeHtml(CATEGORY_LABELS[definition.category])} 도감</span>
  </nav>
  <main class="seo-main">
    <section class="seo-page-intro">
      <p class="seo-eyebrow">알칸시아 공략 자료</p>
      <h1>${escapeHtml(definition.heading)}</h1>
      <p>${escapeHtml(definition.intro)}</p>
      <a class="seo-interactive-link" href="../#codex/${escapeAttribute(definition.category)}">대화형 도감에서 열기</a>
    </section>
    <nav class="seo-category-links" aria-label="알칸시아 도감">
        ${navigation}
    </nav>
    <section class="seo-card-grid" aria-label="${escapeAttribute(CATEGORY_LABELS[definition.category])} 목록">
${indent(cards, 6)}
    </section>
  </main>
  <footer class="seo-footer">
    <p>이 페이지는 알칸시아 유저를 위한 비공식 팬 제작 자료이며 공식 서비스가 아닙니다.</p>
    <p><a href="${OFFICIAL_SITE}" target="_blank" rel="noopener noreferrer">알칸시아 공식 사이트</a> · <a href="../">이끼제리 팬페이지 홈</a></p>
  </footer>
</body>
</html>
`;
}

export function renderSitemap(definitions = SEO_PAGE_DEFINITIONS) {
  const urls = [SITE_ROOT, ...definitions.map(({ canonical }) => canonical)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}
</urlset>
`;
}

function createContext(gameData, names) {
  const brewByOutput = new Map();
  for (const recipe of gameData.brew_recipes || []) {
    if (recipe.output) brewByOutput.set(recipe.output, recipe.inputs || []);
  }

  const craftByOutput = new Map();
  for (const recipe of gameData.recipes_full || []) {
    if (recipe.type === "brew" || !recipe.output || (recipe.inputs || []).includes(recipe.output)) continue;
    const recipes = craftByOutput.get(recipe.output) || [];
    recipes.push(recipe);
    craftByOutput.set(recipe.output, recipes);
  }

  const usesByInput = new Map();
  const addUse = (input, output, kind) => {
    const uses = usesByInput.get(input) || [];
    if (!uses.some((use) => use.output === output && use.kind === kind)) uses.push({ output, kind });
    usesByInput.set(input, uses);
  };
  for (const recipe of gameData.brew_recipes || []) {
    for (const input of recipe.inputs || []) addUse(input, recipe.output, "양조");
  }
  for (const recipes of craftByOutput.values()) {
    for (const recipe of recipes) {
      for (const input of recipe.inputs || []) addUse(input, recipe.output, "제작");
    }
  }

  const zonesByMonster = new Map();
  for (const [zoneId, zone] of Object.entries(gameData.zones || {})) {
    for (const monsterId of zone.monsters || []) {
      const zones = zonesByMonster.get(monsterId) || [];
      zones.push({ id: zoneId, name: zone.name });
      zonesByMonster.set(monsterId, zones);
    }
  }

  const plantsByProduce = new Map();
  for (const [plantId, plant] of publicEntries(gameData.plants, gameData)) {
    for (const produce of plant.produces || []) {
      if (produce.itemCode) plantsByProduce.set(produce.itemCode, plant.name);
      if (produce.ripen?.itemCode) plantsByProduce.set(produce.ripen.itemCode, plant.name);
    }
  }

  return {
    gameData,
    names,
    brewByOutput,
    craftByOutput,
    usesByInput,
    zonesByMonster,
    plantsByProduce,
  };
}

function renderCategory(category, context) {
  switch (category) {
    case "plants": return renderPlants(context);
    case "potions": return renderPotions(context);
    case "skills": return renderSkills(context);
    case "monsters": return renderMonsters(context);
    case "adventurers": return renderAdventurers(context);
    case "items": return renderItems(context);
    default: throw new TypeError(`지원하지 않는 SEO 카테고리: ${category}`);
  }
}

function renderPlants({ gameData, names }) {
  return publicEntries(gameData.plants, gameData).map(([id, plant]) => {
    const produce = (plant.produces || [])[0];
    const rows = [
      ["성장", formatDuration(plant.growTime_ms)],
      ["수명", plant.oneShot ? "1회성" : plant.maxHarvests == null ? "무한" : `${formatNumber(plant.maxHarvests)}회`],
    ];
    if (produce) {
      rows.push(["생산 주기", produce.interval_ms ? formatDuration(produce.interval_ms) : "—"]);
      if (produce.max > 1) rows.push(["회당 생산", `${formatNumber(produce.max)}개`]);
      const outputs = [itemName(produce.itemCode, gameData, names)];
      if (produce.ripen?.itemCode) outputs.push(`숙성 → ${itemName(produce.ripen.itemCode, gameData, names)}`);
      rows.push(["생산물", outputs.join(" · ")]);
    }
    return renderCard(plant.name || id, rows, plant.perk ? [`특수 효과: ${plant.perk}`] : []);
  }).join("\n");
}

function renderPotions(context) {
  const { gameData } = context;
  return publicEntries(gameData.items, gameData)
    .filter(([code, item]) => item.type === "potion" && !ITEM_TAB_POTIONS.has(code))
    .map(([code, item]) => {
      const recipe = context.brewByOutput.get(code);
      const use = gameData.potion_use_effects?.[code];
      const combat = gameData.potion_effects?.[code];
      const rows = [
        ["양조 시간", formatDuration(craftTime(code, context))],
        ["상점 판매가", Number.isFinite(gameData.sell_price?.[code]) ? `${formatNumber(gameData.sell_price[code])} G` : "판매 불가"],
      ];
      if (recipe?.length) rows.push(["재료 조합", recipe.map((input) => itemName(input, gameData, context.names)).join(" + ")]);
      if (use?.formula || use?.base) rows.push(["사용 효과", formatFormula(use.formula || use.base)]);
      if (combat?.formula || combat?.base) {
        const targets = (combat.targets || []).map((target) => TARGET_LABELS[target] || target).join(", ");
        rows.push(["전투 효과", `${formatFormula(combat.formula || combat.base)}${targets ? ` (${targets})` : ""}`]);
      }
      if (!use && !combat && !gameData.transmute_effects?.[code]) rows.push(["효과", "—"]);
      const notes = [];
      if (gameData.use_duration?.includes(code)) notes.push("지속형 사용 효과: 기본 10분, 강화 시 지속 시간 증가");
      if (gameData.transmute_effects?.[code]) notes.push(`변성: ${gameData.transmute_effects[code]}`);
      return renderCard(item.name || code, rows, notes);
    }).join("\n");
}

function renderSkills({ gameData }) {
  return publicEntries(gameData.skills, gameData).map(([id, skill]) => {
    const prereqs = (skill.prereqs || [])
      .filter((prereq) => gameData.skills?.[prereq.id])
      .map((prereq) => `${gameData.skills[prereq.id].name} Lv${prereq.level}`);
    const rows = [
      ["계열", SKILL_TREES[skill.treeId] || skill.treeId || "—"],
      ["최대 레벨", skill.maxLevel ?? "—"],
      ["효과", formatFormula(skill.formula || skill.description)],
    ];
    if (prereqs.length) rows.push(["선행 조건", prereqs.join(", ")]);
    return renderCard(skill.name || id, rows, skill.flavor ? [skill.flavor] : []);
  }).join("\n");
}

function renderMonsters({ gameData, zonesByMonster }) {
  return publicEntries(gameData.monsters, gameData)
    .sort(([, a], [, b]) => (a.hp || 0) - (b.hp || 0))
    .map(([id, monster]) => {
      const zones = (zonesByMonster.get(id) || []).map(({ name }) => name);
      const rows = [
        ["지역", zones.length ? zones.join(", ") : "기타 (특수)"],
        ["스탯", `HP ${formatNumber(monster.hp)} · ATK ${formatNumber(monster.atk)} · DEF ${formatNumber(monster.def)} · MP ${formatNumber(monster.mp)}`],
      ];
      const notes = (monster.skills || []).map((skill) => {
        const meta = [];
        if (skill.coef != null) meta.push(`계수 ${skill.coef}`);
        if (skill.cd) meta.push(`쿨 ${skill.cd}`);
        if (skill.mp) meta.push(`MP ${skill.mp}`);
        return `${skill.name}: ${skill.desc || skill.description || "—"}${meta.length ? ` (${meta.join(" · ")})` : ""}`;
      });
      return renderCard(`${monster.name || id}${monster.boss ? " (보스)" : ""}`, rows, notes);
    }).join("\n");
}

function renderAdventurers({ gameData }) {
  const roleRank = { tank: 0, dealer: 1, nuker: 2, support: 3, healer: 4 };
  return publicEntries(gameData.adventurers, gameData)
    .sort(([, a], [, b]) => (a.grade || 0) - (b.grade || 0)
      || (roleRank[a.type] ?? 99) - (roleRank[b.type] ?? 99)
      || String(a.name || "").localeCompare(String(b.name || ""), "ko"))
    .map(([id, adventurer]) => {
      const role = ADVENTURER_ROLES[adventurer.type] || adventurer.type || "—";
      const rows = [
        ["역할", `${role} · ★${adventurer.grade || "—"}`],
        ["최초 고용비", formatCost(adventurer.cost)],
        ["스탯", `ATK ${formatNumber(adventurer.atk)} · DEF ${formatNumber(adventurer.def)} · HP ${formatNumber(adventurer.hp)} · MP ${formatNumber(adventurer.mp)}`],
      ];
      if (adventurer.personality) rows.push(["성격", adventurer.personality]);
      const notes = (adventurer.skills || []).map((skill) => {
        const meta = [];
        if (skill.coefficient) meta.push(`계수 ${skill.coefficient}`);
        if (skill.mpCost) meta.push(`MP ${skill.mpCost}`);
        if (skill.cooldown) meta.push(`쿨 ${skill.cooldown}`);
        return `${skill.name}: ${skill.description || "—"}${meta.length ? ` (${meta.join(" · ")})` : ""}`;
      });
      if (adventurer.introduction) notes.push(adventurer.introduction);
      return renderCard(`${adventurer.name || id}${adventurer.title ? ` · ${adventurer.title}` : ""}`, rows, notes);
    }).join("\n");
}

function renderItems(context) {
  const { gameData, names } = context;
  return publicEntries(gameData.items, gameData)
    .filter(([code, item]) => item.type !== "potion" || ITEM_TAB_POTIONS.has(code))
    .map(([code, item]) => {
      const recipes = context.craftByOutput.get(code) || [];
      const brewInputs = context.brewByOutput.get(code);
      const rows = [["분류", ITEM_TAB_POTIONS.has(code) ? "변성 도구" : ITEM_TYPES[item.type] || item.type || "—"]];
      if ((brewInputs || recipes.length) && item.brewDuration_ms) rows.push(["제작 시간", formatDuration(craftTime(code, context))]);
      if (recipes.length) rows.push(["필요 레벨", recipes.map((recipe) => `Lv ${recipe.requiredLevel || 0}`).join(" / ")]);
      if (brewInputs?.length) rows.push(["양조 재료", brewInputs.map((input) => itemName(input, gameData, names)).join(" + ")]);
      recipes.forEach((recipe, index) => rows.push([
        recipes.length > 1 ? `제작 재료 ${index + 1}` : "제작 재료",
        (recipe.inputs || []).map((input) => itemName(input, gameData, names)).join(" + "),
      ]));
      const uses = (context.usesByInput.get(code) || []).slice(0, 8);
      if (uses.length) rows.push(["사용처", uses.map((use) => `${use.kind} ${itemName(use.output, gameData, names)}`).join(" · ")]);
      const source = itemSource(code, context);
      if (source.length) rows.push(["획득", source.join(" · ")]);
      const stat = gameData.equipment_stats?.[code];
      if (stat) rows.push(["기본 스탯", formatStats(stat)]);
      const notes = [item.perk, gameData.gem_effects?.[code]?.desc, item.description].filter(Boolean);
      return renderCard(item.name || code, rows, notes);
    }).join("\n");
}

function publicEntries(collection = {}, gameData = {}) {
  return Object.entries(collection || {}).filter(([code, entry]) => !isExcludedEntry(code, entry, gameData));
}

function renderCard(title, rows, notes = []) {
  const detailRows = rows.map(([label, value]) =>
    `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? "—")}</dd></div>`
  ).join("");
  const noteRows = notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("");
  return `<article class="seo-card">
  <h2>${escapeHtml(title)}</h2>
  <dl>${detailRows}</dl>${noteRows ? `
  <div class="seo-card-notes">${noteRows}</div>` : ""}
</article>`;
}

function itemName(code, gameData, names) {
  return names.items?.[code] || gameData.items?.[code]?.name || code || "—";
}

function itemSource(code, context) {
  const { gameData } = context;
  if (gameData.unobtainable?.includes(code)) return ["획득 불가"];
  const sources = [];
  if (context.brewByOutput.has(code)) sources.push("양조");
  if (context.craftByOutput.has(code)) sources.push("제작");
  if (context.plantsByProduce.has(code)) sources.push(`수확 (${context.plantsByProduce.get(code)})`);
  const zones = [];
  Object.values(gameData.zones || {}).forEach((zone) => {
    if (zone.drops?.[code]) zones.push(zone.name);
  });
  if (zones.length) sources.push(`전리품 (${zones.join(", ")})`);
  if (gameData.shop_items?.includes(code)) sources.push("상점");
  if (gameData.dia_shop?.[code]) sources.push("다이아 상점");
  if (gameData.special_source?.[code]) sources.push(gameData.special_source[code]);
  return sources;
}

function craftTime(code, context) {
  const { gameData, brewByOutput, craftByOutput } = context;
  const duration = (itemCode) => gameData.items?.[itemCode]?.brewDuration_ms || 0;
  const brewInputs = brewByOutput.get(code);
  if (brewInputs?.length) return Math.max(...brewInputs.map(duration));
  const recipes = craftByOutput.get(code);
  if (!recipes?.length) return duration(code);
  return Math.min(...recipes.map((recipe) => {
    const times = (recipe.inputs || []).map(duration);
    const enhancements = times.map(() => 0);
    for (let level = 0; level < (recipe.requiredLevel || 0); level += 1) {
      let minimumIndex = 0;
      for (let index = 1; index < times.length; index += 1) {
        if (times[index] * 2 ** enhancements[index] < times[minimumIndex] * 2 ** enhancements[minimumIndex]) minimumIndex = index;
      }
      enhancements[minimumIndex] += 1;
    }
    return times.length ? Math.max(...times.map((time, index) => time * 2 ** enhancements[index])) : 0;
  }));
}

function formatDuration(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return "—";
  let seconds = Math.max(0, Math.round(Number(ms) / 1000));
  const years = Math.floor(seconds / 31_536_000); seconds %= 31_536_000;
  const days = Math.floor(seconds / 86_400); seconds %= 86_400;
  const hours = Math.floor(seconds / 3_600); seconds %= 3_600;
  const minutes = Math.floor(seconds / 60); seconds %= 60;
  return [
    years && `${formatNumber(years)}년`,
    days && `${days}일`,
    hours && `${hours}시간`,
    minutes && `${minutes}분`,
    (seconds || (!years && !days && !hours && !minutes)) && `${seconds}초`,
  ].filter(Boolean).join(" ");
}

function formatNumber(value) {
  return value == null || !Number.isFinite(Number(value)) ? "—" : Number(value).toLocaleString("ko-KR");
}

function formatFormula(value) {
  if (!value) return "—";
  return String(value)
    .replace(/\$\{([^}]+)\}/g, (_, expression) => expression.replace(/\be\b/g, "Lv").replace(/\*/g, "×").trim())
    .replace(/\|/g, "/");
}

function formatCost(cost) {
  if (!cost || cost.amount == null) return "—";
  if (cost.type === "gold") return `${formatNumber(cost.amount)} G`;
  if (cost.type === "dia") return `${formatNumber(cost.amount)} 다이아`;
  return `${formatNumber(cost.amount)} ${cost.type || ""}`.trim();
}

function formatStats(stats) {
  const values = [];
  if (stats.atk) values.push(`ATK ${formatNumber(stats.atk)}`);
  if (stats.def) values.push(`DEF ${formatNumber(stats.def)}`);
  if (stats.hp) values.push(`HP ${formatNumber(stats.hp)}`);
  if (stats.mp) values.push(`MP ${formatNumber(stats.mp)}`);
  return values.join(" · ") || "스탯 없음";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeXml(value) {
  return escapeHtml(value);
}

function indent(value, spaces) {
  const padding = " ".repeat(spaces);
  return value.split("\n").map((line) => `${padding}${line}`).join("\n");
}

function assertDefinition(definition) {
  for (const key of ["slug", "category", "title", "heading", "description", "intro", "canonical"]) {
    if (!definition?.[key]) throw new TypeError(`SEO 페이지 정의에 ${key} 값이 필요합니다.`);
  }
}
