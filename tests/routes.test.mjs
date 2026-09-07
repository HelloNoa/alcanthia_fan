import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  APP_ROUTE_DEFINITIONS,
  INDEXABLE_APP_ROUTE_DEFINITIONS,
  renderAppRoutePage,
} from "../scripts/app-pages.mjs";
import {
  APP_ROUTE_ENTRIES,
  SITE_NAV_ITEMS,
  legacyRouteFromHash,
  routeHref,
  routePath,
} from "../js/routes.js";

const repoRoot = new URL("../", import.meta.url);
const readRepoFile = (path) => readFileSync(new URL(path, repoRoot), "utf8");

test("top-level navigation resolves to real directories", () => {
  const paths = SITE_NAV_ITEMS.map(({ key }) => routePath(key));
  assert.equal(new Set(paths).size, SITE_NAV_ITEMS.length);
  assert.deepEqual(paths, [
    "garden/",
    "watch/",
    "planner/",
    "market/",
    "residents/",
    "rank/",
    "quests/",
    "plants/",
    "random/",
    "skilltree/",
    "calc/",
    "patch-notes/",
  ]);
  for (const { key } of SITE_NAV_ITEMS) assert.equal(routeHref(key).includes("#"), false);
});

test("nested calculator, quest, and codex routes use refresh-safe paths", () => {
  assert.equal(routePath("calc/time"), "calc/time/");
  assert.equal(routePath("calc/brew"), "calc/");
  assert.equal(routePath("quests/weekly"), "quests/weekly/");
  assert.equal(routePath("quests/daily"), "quests/");
  assert.equal(routePath("codex/achievements"), "achievements/");
  assert.equal(routePath("codex/transmute"), "transmute/");
  assert.equal(routePath("codex/items"), "items/");
});

test("legacy fragment routes map to their real-path destinations", () => {
  assert.deepEqual(legacyRouteFromHash("#calc/time"), { route: "calc/time" });
  assert.deepEqual(legacyRouteFromHash("#quests/weekly"), { route: "quests/weekly" });
  assert.deepEqual(legacyRouteFromHash("#codex/achievements"), { route: "codex/achievements" });
  assert.deepEqual(legacyRouteFromHash("#p/abc_123"), { route: "planner", plan: "abc_123" });
  assert.deepEqual(legacyRouteFromHash("#planner/plan/gzu.%EA%B3%B5%EC%9C%A0"), { route: "planner", plan: "gzu.공유" });
  assert.equal(legacyRouteFromHash("#unknown"), null);
});

test("generated app route entries are complete and match committed files", () => {
  const homepage = readRepoFile("index.html");
  assert.equal(APP_ROUTE_ENTRIES.length, 23);
  assert.equal(APP_ROUTE_DEFINITIONS.length, APP_ROUTE_ENTRIES.length);
  assert.equal(INDEXABLE_APP_ROUTE_DEFINITIONS.length, 18);
  assert.equal(new Set(APP_ROUTE_ENTRIES.map(({ path }) => path)).size, APP_ROUTE_ENTRIES.length);
  assert.equal(APP_ROUTE_ENTRIES.some(({ path }) => path === "calc/brew"), false);
  assert.equal(APP_ROUTE_ENTRIES.some(({ path }) => path === "quests/daily"), false);

  for (const key of ["title", "heading", "description", "canonical"]) {
    const values = APP_ROUTE_DEFINITIONS.map((definition) => definition[key]);
    assert.equal(new Set(values).size, APP_ROUTE_DEFINITIONS.length, `${key} must be unique`);
    assert.equal(values.every(Boolean), true, `${key} must be populated`);
  }

  for (const definition of APP_ROUTE_DEFINITIONS) {
    const generated = renderAppRoutePage(definition, homepage, { patchNotes: JSON.parse(readRepoFile("data/patch-notes.json")) });
    assert.equal(readRepoFile(`${definition.path}/index.html`), generated, `${definition.path} must be regenerated`);
    assert.match(generated, new RegExp(`<body class="app-route-page" data-route="${definition.route}">`));
    assert.match(generated, new RegExp(`<title>${escapeRegExp(definition.title)}<\\/title>`));
    assert.match(generated, new RegExp(`<link rel="canonical" href="${escapeRegExp(definition.canonical)}">`));
    assert.match(generated, new RegExp(`<h1 id="route-seo-title">${escapeRegExp(definition.heading)}<\\/h1>`));
    assert.match(generated, new RegExp(`<meta name="robots" content="${definition.indexable ? "index" : "noindex"},follow">`));
    const metadata = extractJsonLd(generated);
    assert.equal(metadata["@type"], "WebPage");
    assert.equal(metadata["@id"], `${definition.canonical}#webpage`);
    assert.equal(metadata.name, definition.title);
    assert.equal(metadata.url, definition.canonical);
    assert.equal(metadata.description, definition.description);
    assert.doesNotMatch(generated, /class="home-seo-intro"/);
    assert.doesNotMatch(generated, /href="[^"]*#/);
  }
});

function extractJsonLd(html) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  return JSON.parse(scripts[0][1]);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
