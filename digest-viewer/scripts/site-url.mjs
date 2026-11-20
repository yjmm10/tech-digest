/** 构建 RSS / 绝对链接时使用的站点根 URL（末尾带 /） */
export function resolveSiteUrl() {
  const fromEnv = process.env.SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.endsWith("/") ? fromEnv : `${fromEnv}/`;
  }

  const base = process.env.VITE_BASE?.trim();
  if (base?.startsWith("http://") || base?.startsWith("https://")) {
    return base.endsWith("/") ? base : `${base}/`;
  }

  if (base === "/tech-digest/" || base === "/tech-digest") {
    return "https://yjmm10.github.io/tech-digest/";
  }

  return "https://yjmm10.github.io/tech-digest/";
}
