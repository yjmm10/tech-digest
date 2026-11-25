export type PageView = "landing" | "entries" | "markdown" | "about";

/** 旧版分享链接可能只带查询参数、不带 hash：视为数据站入口 */
function hasLegacyFilterQuery(): boolean {
  return /\b(q|day|digest|sort|mode|fav|group|layout)=/.test(window.location.search);
}

export function parseRouteHash(): { view: PageView; slug: string } {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (raw === "about") {
    return { view: "about", slug: "" };
  }
  if (raw === "entries") {
    return { view: "entries", slug: "" };
  }
  if (raw === "markdown" || raw.startsWith("markdown/")) {
    const slug =
      raw === "markdown"
        ? ""
        : decodeURIComponent(raw.slice("markdown/".length));
    return { view: "markdown", slug };
  }
  if (raw === "" && hasLegacyFilterQuery()) {
    return { view: "entries", slug: "" };
  }
  // 其余情况（含空 hash 与未知锚点）→ 落地页
  return { view: "landing", slug: "" };
}

export function setRouteHash(view: PageView, slug?: string) {
  const current = window.location.hash.replace(/^#/, "").trim();
  if (view === "markdown") {
    const next = slug ? `markdown/${encodeURIComponent(slug)}` : "markdown";
    if (current !== next) {
      window.location.hash = next;
    }
    return;
  }
  if (view === "about") {
    if (current !== "about") {
      window.location.hash = "about";
    }
    return;
  }
  if (view === "entries") {
    if (current !== "entries") {
      window.location.hash = "entries";
    }
    return;
  }
  // landing：回首页即清空 hash
  if (window.location.hash) {
    window.location.hash = "";
  }
}
