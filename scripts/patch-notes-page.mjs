import { validateSnapshot } from "./patch-notes.mjs";

const escape = (text) => String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const formatDate = (date) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date(date));

export function renderPatchNotesContent(snapshot) {
  validateSnapshot(snapshot);
  const section = (heading, lines) => lines.length
    ? `<section><h3>${heading}</h3><ul>${lines.map((line) => `<li>${escape(line)}</li>`).join("")}</ul></section>` : "";
  return `<main id="view">
    <section class="patch-notes" aria-labelledby="route-seo-title">
      <p class="seo-eyebrow">공식 게임 업데이트 · 본서버</p>
      <h1 id="route-seo-title">알칸시아 패치내역</h1>
      <p>공식 게임에서 공개한 업데이트와 오류 수정 내역입니다. 테스트 서버 내역은 포함하지 않습니다.</p>
      <p class="patch-source"><a href="${snapshot.source.site}" target="_blank" rel="noopener noreferrer">출처: 알칸시아 공식 게임</a> · 비공식 팬페이지에서 모아보기</p>
      <p class="patch-meta">자료 수집: <time datetime="${snapshot.syncedAt}">${formatDate(snapshot.syncedAt)}</time> (한국 시간)<br>15분 간격 확인 예정 · 예약 실행과 배포 상황에 따라 반영이 늦어질 수 있습니다.</p>
      <label class="patch-search" hidden data-patch-search-label>
        <span>패치내역 검색</span>
        <input type="search" placeholder="아이템, 변경 내용, 날짜 검색…" autocomplete="off" data-patch-search>
      </label>
      <p class="patch-count" role="status" data-patch-count>총 ${snapshot.notes.length}개 업데이트 · 최신순</p>
      <div class="patch-list">
        ${snapshot.notes.map((note, index) => `<details class="patch-note" data-patch-note${index === 0 ? " open" : ""}>
          <summary><time datetime="${escape(note.date)}">${formatDate(note.date)}</time>${index === 0 ? '<span class="patch-badge">최신</span>' : ""}<small>업데이트 ${note.highlights.length} · 수정 ${note.fixes.length}</small></summary>
          <div class="patch-body">${section("새로운 내용 · 개선", note.highlights)}${section("오류 수정", note.fixes)}</div>
        </details>`).join("\n        ")}
      </div>
      <p data-patch-empty hidden>검색 결과가 없습니다.</p>
    </section>
  </main>`;
}
