import { api, gamedata, names } from "./api.js";
import { itemIconURLs, loadImg } from "./sprites.js";
import { parseItemKey } from "./item_key.js";

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
        const detail = document.createElement("details");
        detail.className = "shop-products";
        detail.append(text("summary", "등록 상품 보기"));
        const body = text("div", "", "shop-products-body");
        body.setAttribute("aria-live", "polite");
        detail.append(body);
        let loaded = false, loading = false;
        const loadProducts = async () => {
          if (loading) return;
          loading = true;
          body.replaceChildren(text("p", "상품을 불러오는 중…", "muted"));
          try {
            const [result, labels] = await Promise.all([api.playerShop(shop.id), names()]);
            if (!detail.isConnected) return;
            body.replaceChildren();
            if (!result.shop) {
              body.append(text("p", "가판대를 찾을 수 없습니다. 목록을 새로고침해 주세요."));
              loaded = true;
              return;
            }
            if (!Array.isArray(result.shop.offers)) throw new Error("invalid shop offers");
            if (result.shop.description) body.append(text("p", result.shop.description, "shop-description"));
            const offers = result.shop.offers.filter(offer => offer.published);
            if (!offers.length) body.append(text("p", "공개된 등록 상품이 없습니다.", "muted"));
            const itemLabel = item => `${item.itemKey.replace(/[a-z][a-z0-9_]*/g, code => labels.items?.[code] || labels.plants?.[code] || code)} × ${item.count.toLocaleString()}`;
            const itemRow = item => {
              const row = text("li", "", "shop-item-row");
              const icon = text("span", "", "shop-item-icon");
              icon.setAttribute("aria-hidden", "true");
              row.append(icon, text("span", itemLabel(item)));
              const code = parseItemKey(item.itemKey).code;
              itemIconURLs(code).then(urls => {
                const image = loadImg(icon, urls, text("span", "◇"), "shop-item-image");
                image.alt = "";
                image.width = image.height = 36;
              });
              return row;
            };
            for (const offer of offers) {
              const product = text("section", "", "shop-product");
              product.append(text("h4", offer.title), text("small", offer.type === "vending" ? "즉시 구매" : "견적 거래 · 협의", "muted"));
              if (offer.description) product.append(text("p", offer.description, "shop-description"));
              if (offer.quote) {
                product.append(text("p", "받는 상품", "shop-product-label"));
                const delivery = document.createElement("ul");
                for (const item of offer.quote.delivery) delivery.append(itemRow(item));
                product.append(delivery, text("p", "지불 조건 (1회 거래 기준)", "shop-product-label"));
                const payment = document.createElement("ul");
                payment.append(text("li", `${offer.quote.paymentGold.toLocaleString()} 골드`));
                for (const item of offer.quote.payment) payment.append(itemRow(item));
                product.append(payment);
                if (offer.quote.deliveryDays != null) product.append(text("p", `납기 · ${offer.quote.deliveryDays}일`));
              } else {
                product.append(text("p", "제공 상품과 지불 조건은 게임에서 판매자와 협의해 주세요.", "muted"));
              }
              body.append(product);
            }
            body.append(text("p", "재고와 구매 가능 여부는 게임에서 확인해 주세요.", "muted shops-note"));
            loaded = true;
          } catch {
            if (!detail.isConnected) return;
            body.replaceChildren(text("p", "상품을 불러오지 못했습니다."));
            const again = text("button", "상품 다시 시도");
            again.type = "button";
            again.onclick = loadProducts;
            body.append(again);
          } finally { loading = false; }
        };
        detail.addEventListener("toggle", () => { if (detail.open && !loaded) loadProducts(); });
        card.append(detail);
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
