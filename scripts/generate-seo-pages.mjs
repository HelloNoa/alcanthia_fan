#!/usr/bin/env node

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SEO_PAGE_DEFINITIONS, renderSeoPage, renderSitemap } from "./seo-pages.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowedArguments = new Set(["--check"]);
const unknownArguments = process.argv.slice(2).filter((argument) => !allowedArguments.has(argument));

if (unknownArguments.length) {
  console.error(`알 수 없는 옵션: ${unknownArguments.join(", ")}`);
  console.error("사용법: node scripts/generate-seo-pages.mjs [--check]");
  process.exitCode = 2;
} else {
  const [gameData, names] = await Promise.all([
    readJson(resolve(repoRoot, "data/gamedata.json")),
    readJson(resolve(repoRoot, "data/names.json")),
  ]);
  const artifacts = [
    ...SEO_PAGE_DEFINITIONS.map((definition) => ({
      path: resolve(repoRoot, definition.slug, "index.html"),
      content: renderSeoPage(definition, gameData, names),
    })),
    { path: resolve(repoRoot, "sitemap.xml"), content: renderSitemap(SEO_PAGE_DEFINITIONS) },
  ];

  if (process.argv.includes("--check")) {
    const stale = [];
    for (const artifact of artifacts) {
      try {
        if (await readFile(artifact.path, "utf8") !== artifact.content) stale.push(relativePath(artifact.path));
      } catch (error) {
        if (error.code === "ENOENT") stale.push(relativePath(artifact.path));
        else throw error;
      }
    }
    if (stale.length) {
      console.error(`SEO 생성물이 최신 데이터와 일치하지 않습니다: ${stale.join(", ")}`);
      console.error("node scripts/generate-seo-pages.mjs 를 실행해 갱신하세요.");
      process.exitCode = 1;
    } else {
      console.log(`SEO 생성물 ${artifacts.length}개가 최신 상태입니다.`);
    }
  } else {
    for (const artifact of artifacts) await writeAtomically(artifact.path, artifact.content);
    console.log(`SEO 생성물 ${artifacts.length}개를 갱신했습니다.`);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeAtomically(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  try {
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

function relativePath(path) {
  return path.slice(repoRoot.length + 1);
}
