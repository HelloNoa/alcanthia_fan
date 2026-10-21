import { api, gamedata } from "./api.js";

export function renderPlayerShops(view) {
  view.innerHTML = `<section class="player-shops">
    <h2>🏪 가판대</h2>
    <p class="muted">지역별 가판대를 찾아보세요. 상품 수는 등록된 거래 제안 수이며 재고 수량과는 다릅니다.</p>
    <form class="shops-search">
      <label class="shops-zone-label" for="shops-zone">지역 <select id="shops-zone"><option value="town">안개마을</option></select></label>
      <label for="shops-query">가판대 검색</label>
      <div class="shops-search-row"><input id="shops-query" type="search" maxlength="40" placeholder="판매자 · 가판대명 · 아이템" autocomplete="off"><button type="submit">검색</button></div>
      <div class="shops-options"><label><input id="shops-open" type="checkbox" checked> 영업 중만</label><button type="button" id="shops-refresh">새로고침</button></div>
    </form>
    <p class="shops-status muted" role="status" aria-live="polite"></p>
    <div class="shops-list"></div>
    <button type="button" id="shops-retry" hidden>다시 시도</button>
    <nav class="shops-pages" aria-label="가판대 페이지"><button type="button" id="shops-prev">이전</button><span id="shops-page"></span><button type="button" id="shops-next">다음</button></nav>
    <p class="muted shops-note">목록은 조회 시 갱신됩니다. 최대 30초 전 결과가 표시될 수 있습니다. 실제 상품 확인과 거래는 게임에서 진행해 주세요.</p>
  </section>`;
  const root = view.querySelector(".player-shops");
  const $ = selector => root.querySelector(selector);
  const status = $(".shops-status"), list = $(".shops-list");
  const prev = $("#shops-prev"), next = $("#shops-next"), retry = $("#shops-retry");
  let zone = "town", query = "", openOnly = true, offset = 0, request = 0;
  const limit = 20;
  const text = (tag, value, className) => {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  };
  async function load() {
    const current = ++request;
    prev.disabled = next.disabled = true;
    retry.hidden = true;
    list.replaceChildren();
    list.setAttribute("aria-busy", "true");
    $("#shops-page").textContent = `${offset / limit + 1}페이지`;
    status.textContent = "가판대 목록을 불러오는 중…";
    try {
      const data = await api.playerShops({ zone, q: query, openOnly, offset, limit, includeTotal: true });
      if (current !== request || !root.isConnected) return;
      if (!Array.isArray(data.shops) || typeof data.hasMore !== "boolean") throw new Error("invalid response");
      for (const shop of data.shops) {
        const card = text("article", "", "shop-card");
        const heading = text("div", "", "shop-heading");
        heading.append(text("h3", shop.title || "이름 없는 가판대"), text("span", shop.accepting ? "영업 중" : "영업 종료", `shop-state ${shop.accepting ? "is-open" : ""}`));
        card.append(heading, text("p", `판매자 · ${shop.nickname || "닉네임 없음"}`));
        card.append(text("p", `등록 상품 ${shop.offerCount ?? 0}개`, "shop-offers"));
        card.append(text("small", `가판대 #${shop.id}`, "muted"));
        list.append(card);
      }
      const total = Number.isInteger(data.shopsTotal) ? ` · 이 지역 검색 결과 ${data.shopsTotal.toLocaleString()}곳` : "";
      status.textContent = data.shops.length
        ? `${data.shops.length}곳 표시${total} · 조회 ${new Date().toLocaleTimeString("ko-KR")}`
        : "조건에 맞는 가판대가 없습니다. 지역, 검색어나 영업 중 필터를 바꿔 보세요.";
      prev.disabled = offset === 0;
      next.disabled = !data.hasMore;
    } catch {
      if (current !== request || !root.isConnected) return;
      list.replaceChildren();
      status.textContent = "가판대 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
      retry.hidden = false;
      prev.disabled = offset === 0;
    } finally {
      if (current === request && root.isConnected) list.setAttribute("aria-busy", "false");
    }
  }
  // Use actual adventure regions; names.zones also contains cosmetic themes.
  gamedata().then(data => {
    if (!root.isConnected) return;
    for (const [id, region] of Object.entries(data.zones || {})) {
      const option = text("option", region.name || id);
      option.value = id;
      $("#shops-zone").append(option);
    }
  }).catch(() => {
    status.textContent = "지역 목록을 불러오지 못했습니다. 페이지를 새로고침해 주세요.";
  });
  $("#shops-zone").addEventListener("change", event => {
    zone = event.target.value; offset = 0; load();
  });
  $("form").addEventListener("submit", event => {
    event.preventDefault(); query = $("#shops-query").value.trim(); offset = 0; load();
  });
  $("#shops-open").addEventListener("change", event => {
    openOnly = event.target.checked; offset = 0; load();
  });
  $("#shops-refresh").onclick = retry.onclick = () => load();
  prev.onclick = () => { offset = Math.max(0, offset - limit); load(); };
  next.onclick = () => { offset += limit; load(); };
  return load();
}
