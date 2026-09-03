const input = document.querySelector("[data-seo-filter]");
const cards = [...document.querySelectorAll(".seo-card")];
const count = document.querySelector("[data-seo-result-count]");
const empty = document.querySelector("[data-seo-empty]");
const siteNavigation = document.querySelector(".site-tabs");
const activeSiteNavigation = siteNavigation?.querySelector("[aria-current='page']");

const normalize = (value) => String(value || "").trim().toLocaleLowerCase("ko-KR");

function update() {
  const query = normalize(input?.value);
  let visible = 0;
  cards.forEach((card) => {
    const matches = !query || normalize(card.textContent).includes(query);
    card.hidden = !matches;
    if (matches) visible += 1;
  });
  if (count) count.textContent = `${visible.toLocaleString("ko-KR")}개`;
  if (empty) empty.hidden = visible !== 0;
}

document.querySelectorAll(".seo-card-title img[data-fallback-src]").forEach((image) => {
  image.addEventListener("error", () => {
    const fallback = image.dataset.fallbackSrc;
    delete image.dataset.fallbackSrc;
    if (fallback) image.src = fallback;
    else image.hidden = true;
  });
});

input?.addEventListener("input", update);
if (window.matchMedia?.("(max-width: 640px)").matches && activeSiteNavigation) {
  const revealActiveSiteNavigation = () => {
    siteNavigation.scrollLeft = Math.max(
      0,
      activeSiteNavigation.offsetLeft - (siteNavigation.clientWidth - activeSiteNavigation.clientWidth) / 2,
    );
  };
  if (document.readyState === "complete") revealActiveSiteNavigation();
  else window.addEventListener("load", revealActiveSiteNavigation, { once: true });
}
update();
