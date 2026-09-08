import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SEO_PAGE_DEFINITIONS,
  renderSeoPage,
  renderSitemap,
} from "../scripts/seo-pages.mjs";
import {
  APP_ROUTE_DEFINITIONS,
  INDEXABLE_APP_ROUTE_DEFINITIONS,
} from "../scripts/app-pages.mjs";
import { SITE_NAV_ITEMS, routePath } from "../js/routes.js";

const repoRoot = new URL("../", import.meta.url);
const readRepoFile = (path) => readFileSync(new URL(path, repoRoot), "utf8");
const readJson = (path) => JSON.parse(readRepoFile(path));
const gameData = readJson("data/gamedata.json");
const names = readJson("data/names.json");
const slugs = ["plants", "potions", "skills", "monsters", "adventurers", "items"];
const siteRoot = "https://hellonoa.github.io/alcanthia_fan/";
const sitemapDefinitions = [...SEO_PAGE_DEFINITIONS, ...INDEXABLE_APP_ROUTE_DEFINITIONS];

test("every public page promotes the same clearly unofficial Discord community", () => {
  const paths = ["index.html", ...SEO_PAGE_DEFINITIONS.map(({ slug }) => `${slug}/index.html`),
    ...APP_ROUTE_DEFINITIONS.map(({ path }) => `${path}/index.html`)];
  for (const path of paths) {
    const html = readRepoFile(path);
    const banners = [...html.matchAll(/<aside class="community-banner"[\s\S]*?<\/aside>/g)];
    assert.equal(banners.length, 1, `${path} must show exactly one community banner`);
    const banner = banners[0][0];
    assert.match(banner, /알칸시아 사설 디스코드/);
    assert.match(banner, /이끼제리에서 운영하는 비공식 커뮤니티/);
    assert.match(banner, /<a[^>]*href="https:\/\/discord\.gg\/tBz3KXSvR"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    assert.match(banner, /디스코드 참여/);
    assert.doesNotMatch(banner, /<iframe|<script/);
    assert.ok(html.indexOf(banner) < html.indexOf("<main"), `${path} must show the invitation above page content`);
  }
});

test("homepage exposes crawlable Alcanthia content", () => {
  const html = readRepoFile("index.html");
  assert.match(html, /<title>알칸시아 공략·도감·계산기 \| 이끼제리 팬페이지<\/title>/);
  assert.match(html, /<meta\s+name="description"\s+content="알칸시아 작물·포션·스킬·몬스터·모험가 도감과 텃밭 배치, 스킬트리, 계산기를 제공하는 비공식 팬페이지입니다\."\s*\/?>/);
  assert.match(html, /<meta\s+name="google-site-verification"\s+content="uCMjr2jFEn_XK5bCE-LDJAZExcH_6pJ8dDQF4C04oqQ"\s*\/?>/);
  assert.match(html, /<link\s+rel="canonical"\s+href="https:\/\/hellonoa\.github\.io\/alcanthia_fan\/"\s*\/?>/);
  assert.match(html, /알칸시아 — 마녀의 텃밭 유저를 위한 비공식 팬페이지입니다\./);
  for (const slug of slugs) assert.match(html, new RegExp(`href=["']\\./${slug}/["']`));
  assert.ok(html.indexOf('<main id="view"></main>') < html.indexOf('class="home-seo-intro"'));
});

test("homepage publishes accurate social and WebSite metadata", () => {
  const html = readRepoFile("index.html");
  assertSocialMetadata(html, {
    title: "알칸시아 공략·도감·계산기 | 이끼제리 팬페이지",
    description: "알칸시아 작물·포션·스킬·몬스터·모험가 도감과 텃밭 배치, 스킬트리, 계산기를 제공하는 비공식 팬페이지입니다.",
    type: "website",
    url: siteRoot,
  });
  const metadata = extractJsonLd(html);
  assert.equal(metadata["@type"], "WebSite");
  assert.equal(metadata["@id"], `${siteRoot}#website`);
  assert.equal(metadata.url, siteRoot);
  assert.equal(metadata.inLanguage, "ko-KR");
  assert.match(metadata.description, /비공식/);
  assert.equal("publisher" in metadata, false);
});

test("public header hides the proxy URL and the homepage explains its source", () => {
  const html = readRepoFile("index.html");
  assert.doesNotMatch(html, /proxy:\s*<code/i);
  assert.match(html, /<button[^>]+id="proxy"[^>]*>연결 설정<\/button>/);
  assert.match(html, /데이터:\s*저장소의 gamedata\.json 기반 정적 생성/);
  assert.match(html, /제작자\s*노아/);
  assert.match(html, /비공식 팬 제작/);

  const app = readRepoFile("js/app.js");
  assert.doesNotMatch(app, /\.textContent\s*=\s*PROXY_BASE/);
  assert.match(app, /현재 프록시/);
});

test("SEO page definitions have unique metadata and canonical URLs", () => {
  assert.deepEqual(SEO_PAGE_DEFINITIONS.map(({ slug }) => slug), slugs);
  for (const key of ["slug", "title", "heading", "description", "canonical"]) {
    const values = SEO_PAGE_DEFINITIONS.map((definition) => definition[key]);
    assert.equal(new Set(values).size, SEO_PAGE_DEFINITIONS.length, `${key} values must be unique`);
    assert.equal(values.every(Boolean), true, `${key} values must be populated`);
  }
  for (const definition of SEO_PAGE_DEFINITIONS) {
    assert.equal(definition.canonical, `${siteRoot}${definition.slug}/`);
  }
});

test("rendered pages expose complete non-JavaScript content", () => {
  for (const definition of SEO_PAGE_DEFINITIONS) {
    const html = renderSeoPage(definition, gameData, names);
    assert.match(html, /<html lang="ko">/);
    assert.match(html, new RegExp(`<title>${escapeRegExp(definition.title)}<\\/title>`));
    assert.match(html, new RegExp(`content="${escapeRegExp(definition.description)}"`));
    assert.match(html, new RegExp(`href="${escapeRegExp(definition.canonical)}"`));
    assert.equal((html.match(/<h1(?:\s[^>]*)?>/g) || []).length, 1);
    assert.match(html, new RegExp(`<h1(?:\\s[^>]*)?>${escapeRegExp(definition.heading)}<\\/h1>`));
    assert.match(html, /href="https:\/\/www\.alcanthia\.com\/"/);
    assert.match(html, /비공식 팬/);
    assert.match(html, /데이터: 저장소의 gamedata\.json 기반 정적 생성 · 제작자 노아/);
    assert.doesNotMatch(html, /대화형 도감에서 열기/);
    for (const slug of slugs) assert.match(html, new RegExp(`href="\\.\\./${slug}/"`));
    assert.equal((html.match(/class="seo-card"/g) || []).length > 0, true, `${definition.slug} must contain data cards`);
    assert.equal((html.match(/class="seo-card-title"/g) || []).length > 0, true, `${definition.slug} must contain card images`);
    assert.match(html, /<img\s+src="https:\/\/game\.alcanthia\.com\/assets\//);
    assert.match(html, /data-seo-filter/);
    assert.match(html, /src="\.\.\/js\/seo-filter\.js\?v=20260904-nav"/);
    assert.match(html, /class="site-tabs seo-site-tabs"/);
    for (const { key } of SITE_NAV_ITEMS) {
      assert.match(html, new RegExp(`href="\\.\\./${escapeRegExp(routePath(key))}"`));
    }
    assert.match(html, /class="active" aria-current="page" href="\.\.\/plants\/">📖 도감<\/a>/);
    assert.doesNotMatch(html, /href="[^"]*#/);

    assertSocialMetadata(html, {
      title: definition.title,
      description: definition.description,
      type: "website",
      url: definition.canonical,
    });
    const metadata = extractJsonLd(html);
    assert.equal(metadata["@type"], "WebPage");
    assert.equal(metadata["@id"], `${definition.canonical}#webpage`);
    assert.equal(metadata.name, definition.title);
    assert.equal(metadata.url, definition.canonical);
    assert.equal(metadata.description, definition.description);
    assert.equal(metadata.inLanguage, "ko-KR");
    assert.deepEqual(metadata.isPartOf, { "@id": `${siteRoot}#website` });
    assert.equal(metadata.about?.name, "알칸시아");
    assert.equal(metadata.about?.url, "https://www.alcanthia.com/");
    assert.equal("publisher" in metadata, false);
    assert.equal("creator" in metadata, false);
  }
});

test("renderer escapes text and excludes private or test-only data", () => {
  const sampleGameData = {
    plants: {
      safe: {
        name: `안전 <작물> & "이름"`,
        growTime_ms: 1_000,
        oneShot: true,
        produces: [{ itemCode: "safe_item", interval_ms: 500, max: 1 }],
        perk: `효과 <b> & "문장"`,
      },
      aging_hidden: { name: "노출 금지", growTime_ms: 1 },
      named_test: { name: "시험용 작물", growTime_ms: 1 },
    },
    items: {
      safe_item: { name: `수확물 <하나> & "둘"`, type: "produce" },
      listed_test: { name: "목록 테스트", type: "general" },
      explicit_test: { name: "명시 테스트", type: "general", test: true },
      aging_item: { name: "노화 테스트", type: "general" },
      growth_elixir: { name: "성장 엘릭서", type: "potion" },
      poison_fang: { name: "독니", type: "general" },
      condensing_flask: { name: "응축 플라스크", type: "potion" },
      normal_potion: { name: "정상 포션", type: "potion" },
    },
    test_items: ["listed_test"],
  };
  const sampleNames = { items: { safe_item: `수확물 <하나> & "둘"` } };
  const plants = renderSeoPage(SEO_PAGE_DEFINITIONS[0], sampleGameData, sampleNames);
  assert.match(plants, /안전 &lt;작물&gt; &amp; &quot;이름&quot;/);
  assert.match(plants, /효과 &lt;b&gt; &amp; &quot;문장&quot;/);
  assert.doesNotMatch(plants, /<b> & "문장"/);
  assert.doesNotMatch(plants, /노출 금지|시험용 작물/);

  const potions = renderSeoPage(SEO_PAGE_DEFINITIONS[1], sampleGameData, sampleNames);
  assert.match(potions, /정상 포션/);
  assert.doesNotMatch(potions, /성장 엘릭서|응축 플라스크/);

  const items = renderSeoPage(SEO_PAGE_DEFINITIONS[5], sampleGameData, sampleNames);
  assert.doesNotMatch(items, /목록 테스트|명시 테스트|노화 테스트|독니|정상 포션/);

  const unsafeTitle = `제목 </script><script>alert("x")</script> & 끝`;
  const unsafeDefinition = {
    ...SEO_PAGE_DEFINITIONS[0],
    title: unsafeTitle,
    description: `설명 <태그> & "인용"`,
  };
  const unsafePage = renderSeoPage(unsafeDefinition, sampleGameData, sampleNames);
  assert.doesNotMatch(unsafePage, /<script>alert\("x"\)<\/script>/);
  assert.equal(extractJsonLd(unsafePage).name, unsafeTitle);
});

test("navigation uses real paths instead of fragment routes", () => {
  const app = readRepoFile("js/app.js");
  const codex = readRepoFile("js/codex.js");
  const calc = readRepoFile("js/calc.js");
  assert.match(app, /SITE_NAV_ITEMS/);
  assert.match(app, /<a href="\$\{tab\.href\}" data-tab="\$\{key\}"/);
  assert.doesNotMatch(app, /location\.hash\s*=/);
  assert.doesNotMatch(calc, /location\.hash/);
  assert.doesNotMatch(codex, /location\.hash/);
  assert.match(app, /function revealActiveTab\(\)/);
  for (const slug of slugs) {
    assert.match(codex, new RegExp(`routeHref\\("codex/${slug}"\\)`));
  }
  assert.match(codex, /routeHref\("codex\/achievements"\)/);
  assert.match(codex, /routeHref\("codex\/transmute"\)/);

  const filter = readRepoFile("js/seo-filter.js");
  assert.match(filter, /activeSiteNavigation\.offsetLeft/);
});

test("sitemap contains every indexable canonical URL and excludes noindex routes", () => {
  const xml = renderSitemap(sitemapDefinitions);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.equal(xml.includes("#"), false);
  assert.equal((xml.match(/<loc>/g) || []).length, 25);
  assert.match(xml, new RegExp(`<loc>${escapeRegExp(siteRoot)}<\\/loc>`));
  for (const definition of sitemapDefinitions) {
    assert.match(xml, new RegExp(`<loc>${escapeRegExp(definition.canonical)}<\\/loc>`));
  }
  for (const definition of APP_ROUTE_DEFINITIONS.filter(({ indexable }) => !indexable)) {
    assert.doesNotMatch(xml, new RegExp(`<loc>${escapeRegExp(definition.canonical)}<\\/loc>`));
  }
  assert.doesNotMatch(xml, /\/calc\/brew\/|\/quests\/daily\//);
});

test("committed SEO artifacts match the current local data", () => {
  const generatedPages = [];
  for (const definition of SEO_PAGE_DEFINITIONS) {
    const generated = renderSeoPage(definition, gameData, names);
    generatedPages.push(generated);
    assert.equal(readRepoFile(`${definition.slug}/index.html`), generated);
  }
  assert.equal(readRepoFile("sitemap.xml"), renderSitemap(sitemapDefinitions));

  const combined = generatedPages.join("\n");
  for (const code of gameData.test_items || []) {
    const hiddenName = gameData.items?.[code]?.name || gameData.plants?.[code]?.name;
    if (hiddenName) assert.equal(combined.includes(hiddenName), false, `${code} must stay private`);
  }
  for (const privateMarker of ["proxy:", "userId", "nickname"]) {
    assert.equal(combined.includes(privateMarker), false, `${privateMarker} must not be generated`);
  }
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractJsonLd(html) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, "exactly one JSON-LD block is required");
  return JSON.parse(scripts[0][1]);
}

function assertSocialMetadata(html, expected) {
  for (const [property, value] of Object.entries({
    "og:title": expected.title,
    "og:description": expected.description,
    "og:type": expected.type,
    "og:url": expected.url,
    "og:locale": "ko_KR",
  })) {
    assert.match(html, new RegExp(`<meta property="${escapeRegExp(property)}" content="${escapeRegExp(value)}">`));
  }
  for (const [name, value] of Object.entries({
    "twitter:card": "summary",
    "twitter:title": expected.title,
    "twitter:description": expected.description,
  })) {
    assert.match(html, new RegExp(`<meta name="${escapeRegExp(name)}" content="${escapeRegExp(value)}">`));
  }
  assert.doesNotMatch(html, /(?:og|twitter):image/);
}
