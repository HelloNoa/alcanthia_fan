// 프록시 주소 — 로컬 테스트는 localhost, 배포시 본인 Worker/서버 주소로 변경
export const PROXY_BASE = localStorage.getItem("alc_proxy") || "http://localhost:8000";

// 게임 에셋 CDN (식물/아이템 스프라이트 직접 로드)
export const CDN = "https://game.alcanthia.com/assets";

export function setProxy(url) {
  localStorage.setItem("alc_proxy", url.replace(/\/+$/, ""));
  location.reload();
}
