// 프록시 주소 — 우상단 proxy 클릭으로 변경 가능(localStorage 우선)
export const PROXY_BASE = localStorage.getItem("alc_proxy") || "http://152.67.199.228:58000";

// 게임 에셋 CDN (식물/아이템 스프라이트 직접 로드)
export const CDN = "https://game.alcanthia.com/assets";

export function setProxy(url) {
  localStorage.setItem("alc_proxy", url.replace(/\/+$/, ""));
  location.reload();
}
