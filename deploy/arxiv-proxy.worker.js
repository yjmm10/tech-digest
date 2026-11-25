/**
 * arXiv API 反向代理（Cloudflare Worker）
 *
 * 背景：export.arxiv.org 对 GitHub Actions / 云平台共享出口 IP 限流（HTTP 429），
 * 导致 CI 抓取 arXiv 稳定失败。本 Worker 部署在 Cloudflare 边缘节点，
 * 以 Cloudflare 的出口 IP 转发 arXiv 官方 Atom API 请求。
 *
 * 部署（二选一）：
 *   A. Dashboard：https://dash.cloudflare.com → Workers & Pages → Create Worker，
 *      粘贴本文件全部代码，Deploy，记下地址 https://<name>.<account>.workers.dev
 *   B. Wrangler：npx wrangler deploy deploy/arxiv-proxy.worker.js --name arxiv-proxy
 *
 * 接入本项目：
 *   1. 仓库 Settings → Secrets and variables → Actions → Variables，
 *      新增 ARXIV_API_BASE = https://<name>.<account>.workers.dev
 *   2. （可选，推荐）Worker 环境变量设 PROXY_TOKEN 为随机字符串，
 *      并在仓库 Secrets 新增 ARXIV_PROXY_TOKEN = 同值，防止代理被陌生人滥用。
 *
 * 用法（与官方 API 完全同构）：
 *   https://<worker>/api/query?search_query=...&sortBy=...&max_results=20
 *   请求头可带 X-Proxy-Token: <PROXY_TOKEN>（若设置了校验）
 */

const UPSTREAM = "https://export.arxiv.org";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return json({ error: "method not allowed" }, 405);
    }

    // 仅开放 /api/query（Atom API）。需要 OAI-PMH 可自行放开 /oai2。
    if (url.pathname !== "/api/query") {
      return json({ error: "not found" }, 404);
    }

    // 可选 token 校验：Worker 环境变量配置 PROXY_TOKEN 后启用
    const wantToken = (env && env.PROXY_TOKEN ? String(env.PROXY_TOKEN) : "").trim();
    if (wantToken) {
      const got =
        request.headers.get("x-proxy-token") ||
        new URLSearchParams(url.search).get("token") ||
        "";
      if (got !== wantToken) {
        return json({ error: "forbidden" }, 403);
      }
    }

    const upstream = new URL(UPSTREAM + url.pathname + url.search);

    const headers = new Headers();
    // arXiv 规范建议携带可识别 UA 与联系方式
    headers.set(
      "User-Agent",
      (env && env.PROXY_USER_AGENT) ||
        "tech-digest/1.0 (+https://github.com/yjmm10/tech-digest; mailto:lucas4ai@outlook.com)"
    );
    headers.set("Accept", "application/atom+xml,application/xml;q=0.9,*/*;q=0.8");

    // 429/5xx 指数退避重试，最多 4 次
    let resp = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      resp = await fetch(upstream.toString(), { method: "GET", headers });
      if (resp.status !== 429 && resp.status < 500) break;
      const retryAfter = parseFloat(resp.headers.get("retry-after") || "0");
      const waitMs = (Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter
        : 2 ** attempt * 1.5) * 1000;
      await new Promise((r) => setTimeout(r, Math.min(waitMs, 15000)));
    }

    const out = new Headers(resp.headers);
    out.set("x-proxy-upstream", "export.arxiv.org");
    return new Response(resp.body, { status: resp.status, headers: out });
  },
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
