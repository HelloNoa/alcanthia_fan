import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SEO_PAGE_DEFINITIONS,
  renderSeoPage,
  renderSitemap,
} from "../scripts/seo-pages.mjs";

const repoRoot = new URL("../", import.meta.url);
const readRepoFile = (path) => readFileSync(new URL(path, repoRoot), "utf8");
const readJson = (path) => JSON.parse(readRepoFile(path));
const gameData = readJson("data/gamedata.json");
const names = readJson("data/names.json");
const slugs = ["plants", "potions", "skills", "monsters", "adventurers", "items"];
const siteRoot = "https://hellonoa.github.io/alcanthia_fan/";

test("homepage exposes crawlable Alcanthia content", () => {
  const html = readRepoFile("index.html");
  assert.match(html, /<title>알칸시아 공략·도감·계산기 \| 이끼제리 팬페이지<\/title>/);
  assert.match(html, /<meta\s+name="description"\s+content="알칸시아 작물·포션·스킬·몬스터·모험가 도감과 텃밭 배치, 스킬트리, 계산기를 제공하는 비공식 팬페이지입니다\."\s*\/?>/);
  assert.match(html, /<link\s+rel="canonical"\s+href="https:\/\/hellonoa\.github\.io\/alcanthia_fan\/"\s*\/?>/);
  assert.match(html, /알칸시아 — 마녀의 텃밭 유저를 위한 비공식 팬페이지입니다\./);
  for (const slug of slugs) assert.match(html, new RegExp(`href=["']\\./${slug}/["']`));
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
    assert.match(html, /대화형 도감에서 열기/);
    for (const slug of slugs) assert.match(html, new RegExp(`href="\\.\\./${slug}/"`));
    assert.equal((html.match(/class="seo-card"/g) || []).length > 0, true, `${definition.slug} must contain data cards`);
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
});

test("SPA navigation provides real static URLs", () => {
  const app = readRepoFile("js/app.js");
  const codex = readRepoFile("js/codex.js");
  assert.match(app, /codex:\s*\{[^}]*href:\s*"\.\/plants\/"/s);
  for (const slug of slugs) {
    assert.match(codex, new RegExp(`key:\\s*"${slug}"[^}]*href:\\s*"\\.\\/${slug}\\/"`));
  }
});

test("sitemap contains only the seven canonical non-fragment URLs", () => {
  const xml = renderSitemap(SEO_PAGE_DEFINITIONS);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.equal(xml.includes("#"), false);
  assert.equal((xml.match(/<loc>/g) || []).length, 7);
  assert.match(xml, new RegExp(`<loc>${escapeRegExp(siteRoot)}<\\/loc>`));
  for (const definition of SEO_PAGE_DEFINITIONS) {
    assert.match(xml, new RegExp(`<loc>${escapeRegExp(definition.canonical)}<\\/loc>`));
  }
});

test("committed SEO artifacts match the current local data", () => {
  for (const definition of SEO_PAGE_DEFINITIONS) {
    assert.equal(readRepoFile(`${definition.slug}/index.html`), renderSeoPage(definition, gameData, names));
  }
  assert.equal(readRepoFile("sitemap.xml"), renderSitemap(SEO_PAGE_DEFINITIONS));
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
