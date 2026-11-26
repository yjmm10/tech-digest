/**
 * build-static-seo.mjs — AI / 搜索引擎可见性构建期静态化（vite build 之后运行）。
 *
 * 产出（全部写入 dist/，由 prepare-gh-pages-deploy.sh 原样发布）：
 *  1. dist/index.html 注入静态落地页快照（AR-READ-01：内容在初始 HTML 里，React 挂载后无缝替换）
 *  2. dist/index.html head 注入 canonical / OG / JSON-LD（WebSite + Organization）
 *  3. dist/reports/<slug>.html — 每期周报独立静态全文页（可索引、可引用的真实 URL）
 *  4. dist/about.html — 独立关于页（实体信息）
 *  5. dist/robots.txt — 通配允许 + 内容用途声明 + Sitemap
 *  6. dist/sitemap.xml — 首页 + 全部报告页 + about + feed
 *  7. dist/llms.txt / dist/llms-full.txt — AI 上下文文件
 *
 * 幂等：重复运行会先移除上一次注入（以标记注释定位）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { simpleMarkdownToHtml } from "./markdown-render.mjs";
import { resolveSiteUrl } from "./site-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIEWER_DATA = path.resolve(__dirname, "../public/viewer-data.json");
const DIST = path.resolve(__dirname, "../dist");

const SITE = resolveSiteUrl(); // https://yjmm10.github.io/tech-digest/
const REPO_URL = "https://github.com/yjmm10/tech-digest";
const SITE_NAME = "tech-digest";
const SITE_TITLE = "技术周报归档";

/* ---------- 与 src/LandingPage.tsx 保持同步的静态文案 ---------- */

const SOURCES = [
  { name: "arXiv", cls: "arxiv" },
  { name: "Semantic Scholar", cls: "semantic" },
  { name: "OpenAlex", cls: "openalex" },
  { name: "GitHub Trending", cls: "github_weekly" },
  { name: "GitHub Search", cls: "github_search" },
  { name: "RSS 订阅源", cls: "rss" },
];

const FEATURES = [
  {
    key: "sources",
    title: "六源统一调度",
    desc: "arXiv、Semantic Scholar、OpenAlex、GitHub Trending / 检索与 RSS 订阅源，共用关键词与时间窗配置，一次运行全量覆盖。",
  },
  {
    key: "ai",
    title: "AI 摘要与评分",
    desc: "GLM 大模型为每条条目生成中文摘要与 0–10 相关性评分；主模型异常时自动切换备用网关，产出不中断。",
  },
  {
    key: "dedup",
    title: "三级去重清洗",
    desc: "同期次、单期内与跨期按链接三级去重，跨期保留最早记录，确保归档条目唯一、可追溯。",
  },
  {
    key: "filter",
    title: "多维检索回溯",
    desc: "关键词、来源、评分、时间窗与日历自由组合筛选，数据一次加载、全量在客户端完成，交互零延迟。",
  },
  {
    key: "schema",
    title: "Schema v1 结构化归档",
    desc: "每期落盘为独立 JSON（含 Markdown 原文与元数据），历史数据可恢复、可迁移、可二次加工。",
  },
  {
    key: "publish",
    title: "自动发布与订阅",
    desc: "CI 自动构建 GitHub Pages 档案站并生成 RSS 源，抓取完成即上线，全程无需手动运维。",
  },
];

const STEPS = [
  { n: "01", title: "定时抓取", desc: "GitHub Actions 每周五 UTC 12:00 定时触发，多源并发拉取最新内容" },
  { n: "02", title: "清洗去重", desc: "同期次 / 单期内 / 跨期三级去重，过滤无效与重复条目" },
  { n: "03", title: "AI 摘要评分", desc: "GLM 生成中文摘要与相关性评分，备用模型自动接管异常" },
  { n: "04", title: "归档发布", desc: "按 Schema v1 落盘，CI 构建 Pages 站点与 RSS 并推送上线" },
];

/** 首屏预览框示例条目（与 LandingPage.tsx PREVIEW_ROWS 一致） */
const PREVIEW_ROWS = [
  { source: "GH 周榜", sourceClass: "github_weekly", title: "3b1b/manim", desc: "精确程序化数字动画引擎，3Blue1Brown 出品", tags: ["数学动画", "Python", "可视化"], score: 10 },
  { source: "OpenAlex", sourceClass: "openalex", title: "RecoverFly: A Failure-Aware Reinforcement Learning Post-…", desc: "面向 UAV 视觉-语言导航的失败感知 RL 后训练框架，让智能体从执行错误中恢复", tags: ["UAV", "VLN", "强化学习"], score: 10 },
  { source: "GH 检索", sourceClass: "github_search", title: "alexpalms/deeprl-counter-uav-swarm", desc: "强化学习框架，用于决策级无人机集群拦截优先级排序", tags: ["无人机集群", "RL", "拦截决策"], score: 9 },
  { source: "Arxiv", sourceClass: "arxiv", title: "FIRE-VLM: A Vision-Language-Driven Reinforcement Learning…", desc: "视觉-语言模型驱动的强化学习新范式", tags: ["视觉语言", "强化学习"], score: 9 },
];

/** 常见问题（与 LandingPage.tsx FAQ 保持同步；同时输出 FAQPage JSON-LD） */
const FAQ = [
  {
    q: "tech-digest 是什么？",
    a: "tech-digest 是一份每周自动生成的中文技术情报周报与配套开源管线：聚合六类公开信息源，由 GLM 大模型生成中文摘要与相关性评分，三级去重后结构化归档，支持全文检索、日历回溯与 RSS 订阅。",
  },
  {
    q: "周报覆盖哪些数据来源？",
    a: "arXiv 前沿论文、Semantic Scholar、OpenAlex 学术数据、GitHub Trending 周榜、GitHub 关键词检索与自定义 RSS 订阅源，共用关键词与时间窗配置，一次运行全量覆盖。",
  },
  {
    q: "周报多久更新一次？",
    a: "每周五 UTC 12:00 由 GitHub Actions 定时触发，抓取完成后自动构建发布到 GitHub Pages，并同步生成 RSS 订阅源与 JSON 归档。",
  },
  {
    q: "如何订阅或引用本站内容？",
    a: `通过 feed.xml 订阅 RSS 可获取每期全文；本站内容公开，欢迎引用，引用时请注明来源链接 ${SITE}。`,
  },
];

const FOOTER_DESC =
  "多源技术情报抓取与 AI 汇总的开源自动化管线：Python 完成采集与 GLM 摘要评分，条目按 Schema v1 落盘为 JSON 归档，React 档案站提供检索 / 日历 / Markdown 阅读，GitHub Actions 定时构建并发布至 GitHub Pages。";

const SITE_LEAD =
  "基于 GitHub Actions 定时抓取 arXiv、Semantic Scholar、OpenAlex、GitHub 趋势/检索与 RSS 六类公开信息源，由 GLM 大模型生成中文摘要与相关性评分，经三级去重后结构化归档，支持全文检索、日历回溯与 RSS 订阅。";

const SITE_DEFINITION =
  "tech-digest 是一份每周自动更新的中文技术情报周报（AI 技术周报）：聚合 arXiv 论文速递、Semantic Scholar、OpenAlex 学术动态、GitHub 开源趋势与 RSS 资讯，由大模型生成中文摘要与相关性评分，每周五发布并提供 RSS 订阅。";

/* ---------- 工具 ---------- */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 周报标题：技术周报 2026-06-29 ~ 2026-07-05 */
function digestTitle(d) {
  if (d.dateStart && d.dateEnd) return `技术周报 ${d.dateStart} ~ ${d.dateEnd}`;
  return `技术周报 ${d.slug}`;
}

/** 周报静态全文页 URL */
function reportUrl(slug) {
  return `${SITE}reports/${encodeURIComponent(slug)}.html`;
}

/** 从 Markdown 提取纯文本摘要（跳过表格线/标题/引用行）；提取不到时用条目摘要回退 */
function plainDescription(markdown, d, digestEntries = []) {
  const lines = String(markdown || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("|") && !/^:?-{3,}:?$/.test(l.replace(/\s/g, "")));
  const snippet = lines.find((l) => !l.startsWith("#") && !l.startsWith(">")) ?? "";
  const plain = snippet.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const suffix = d.entryCount ? `（本期共 ${d.entryCount} 条）` : "";
  let head = plain.slice(0, 280);
  if (!head && digestEntries.length) {
    head = digestEntries
      .slice(0, 3)
      .map((e) => `${String(e.title ?? "").trim()}：${String(e.summary ?? "").trim()}`)
      .filter((s) => s.replace(/[：\s]/g, "").length > 2)
      .join("；")
      .slice(0, 280);
  }
  return escapeHtml(head ? `${head}${suffix}` : `本期周报${suffix}`);
}

function isoDate(v) {
  const t = v ? new Date(v) : new Date();
  return Number.isNaN(t.getTime()) ? new Date().toISOString().slice(0, 10) : t.toISOString().slice(0, 10);
}

/* ---------- 数据 ---------- */

function loadData() {
  if (!fs.existsSync(VIEWER_DATA)) {
    console.error(`build-static-seo: missing ${VIEWER_DATA}; run build-viewer-data first.`);
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(VIEWER_DATA, "utf-8"));
  const digests = (payload.digests ?? [])
    .filter((d) => (d.markdownBody ?? "").trim())
    .sort((a, b) =>
      (b.dateEnd || b.crawlDate || "").localeCompare(a.dateEnd || a.crawlDate || "") ||
      (b.crawlDate || "").localeCompare(a.crawlDate || ""),
    );
  const entries = payload.entries ?? [];
  const stats = {
    runs: digests.length,
    entries: entries.length,
    sources: new Set(entries.map((e) => e.source).filter(Boolean)).size || 6,
    generatedAt: payload.generatedAt ?? new Date().toISOString(),
  };
  return { payload, digests, entries, stats };
}

/* ---------- 1. 首页静态快照 + head 注入 ---------- */

function featureIconSvg(name) {
  const common =
    'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  switch (name) {
    case "sources":
      return `<svg ${common}><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5" opacity="0.55"/></svg>`;
    case "ai":
      return `<svg ${common}><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01M9.5 16.5h5"/></svg>`;
    case "dedup":
      return `<svg ${common}><path d="M8 6h12M8 12h12M8 18h12"/><path d="m3 5 2 2 3-3" opacity="0.8"/><path d="m3 16 2 2 3-3" opacity="0.5"/></svg>`;
    case "filter":
      return `<svg ${common}><path d="M4 5h16l-6.5 8v6l-3-1.5V13L4 5Z"/></svg>`;
    case "schema":
      return `<svg ${common}><ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5v13c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8v-13"/><path d="M4 12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8"/></svg>`;
    case "publish":
      return `<svg ${common}><path d="M12 3v11"/><path d="m7 9 5-6 5 6"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>`;
    default:
      return `<svg ${common}><circle cx="12" cy="12" r="8"/></svg>`;
  }
}

function buildLandingStatic({ digests, entries, stats }) {
  const latest = digests[0];
  const latestLink = latest ? reportUrl(latest.slug) : `${SITE}feed.xml`;
  const latestTitle = latest ? escapeHtml(digestTitle(latest)) : "RSS 订阅";

  const previewRows = PREVIEW_ROWS.map(
    (r) => `
          <div class="af__row">
            <div class="af__row-top">
              <span class="af__src af__src--${r.sourceClass}">${escapeHtml(r.source)}</span>
              <span class="af__score">${r.score}</span>
            </div>
            <div class="af__row-title">${escapeHtml(r.title)}</div>
            <div class="af__row-desc">${escapeHtml(r.desc)}</div>
            <div class="af__row-tags">${r.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>
          </div>`,
  ).join("");

  const marqueeGroup = SOURCES.map(
    (s) => `<span class="landing__source-chip landing__source-chip--${s.cls}">${escapeHtml(s.name)}</span>`,
  ).join("");

  const featureCards = FEATURES.map(
    (f) => `
            <article class="landing__card">
              <span class="landing__card-icon">${featureIconSvg(f.key)}</span>
              <h3>${escapeHtml(f.title)}</h3>
              <p>${escapeHtml(f.desc)}</p>
            </article>`,
  ).join("\n");

  const stepItems = STEPS.map(
    (s) => `
              <li class="landing__step">
                <span class="landing__step-n">${s.n}</span>
                <h3>${escapeHtml(s.title)}</h3>
                <p>${escapeHtml(s.desc)}</p>
              </li>`,
  ).join("\n");

  const faqCards = FAQ.map(
    (f) => `
            <article class="landing__card landing__faq-card">
              <h3>${escapeHtml(f.q)}</h3>
              <p>${escapeHtml(f.a)}</p>
            </article>`,
  ).join("\n");

  const year = new Date().getFullYear();

  return `
<!--seo-static-start（构建期注入，React 挂载后无缝替换；勿手工编辑）-->
<div class="landing">
  <main>
    <section class="landing__hero">
      <div class="landing__aurora" aria-hidden="true">
        <span class="landing__aurora-blob landing__aurora-blob--a"></span>
        <span class="landing__aurora-blob landing__aurora-blob--b"></span>
      </div>
      <div class="landing__hero-copy">
        <span class="landing__badge"><span class="landing__badge-dot" aria-hidden="true"></span>开源项目 · 每周五自动更新</span>
        <h1>把散落的技术情报<br />收进<em>一份周报</em></h1>
        <p class="landing__lead">${escapeHtml(SITE_LEAD)}</p>
        <p class="landing__seo-def">${escapeHtml(SITE_DEFINITION)}</p>
        <div class="landing__actions">
          <a class="landing__cta" href="#entries">进入数据站</a>
          <a class="landing__cta landing__cta--ghost" href="${SITE}feed.xml">订阅 RSS</a>
        </div>
        <p class="landing__fact">已归档 <strong>${stats.runs}</strong> 期 · <strong>${stats.entries}</strong> 条 · 覆盖 <strong>${stats.sources}</strong> 类来源</p>
        <p class="landing__fact"><a href="${latestLink}">最新一期：${latestTitle}</a></p>
      </div>
      <div class="landing__frame" aria-hidden="true">
        <div class="af">
          <div class="af__bar"><span class="af__dot"></span><span class="af__dot"></span><span class="af__dot"></span><span class="af__title">技术周报归档 · 数据站</span></div>
          <div class="af__filter"><span class="af__search">搜索条目、标签、仓库…</span><span class="af__chip">评分</span><span class="af__chip af__chip--on">全部</span></div>
          <div class="af__rows">${previewRows}</div>
        </div>
      </div>
    </section>

    <div class="landing__marquee" aria-hidden="true">
      <div class="landing__marquee-track">
        <div class="landing__marquee-group">${marqueeGroup}</div>
        <div class="landing__marquee-group">${marqueeGroup}</div>
      </div>
    </div>

    <section id="features" class="landing__section">
      <div class="landing__section-head"><h2>能力特性</h2><p class="landing__section-sub">一套可自部署的技术情报自动化管线</p></div>
      <div class="landing__grid">${featureCards}</div>
    </section>

    <section id="how" class="landing__section">
      <div class="landing__section-head"><h2>运作方式</h2><p class="landing__section-sub">从信息源到归档发布，全流程由 CI 自动完成</p></div>
      <ol class="landing__steps">${stepItems}
      </ol>
    </section>

    <section class="landing__band-wrap">
      <div class="landing__band">
        <div class="landing__band-item"><strong>${stats.runs}</strong><span>期定时抓取</span></div>
        <div class="landing__band-item"><strong>${stats.entries}</strong><span>条情报条目</span></div>
        <div class="landing__band-item"><strong>${stats.sources}</strong><span>类公开信息源</span></div>
        <div class="landing__band-item"><strong>每周</strong><span>定时更新</span></div>
      </div>
    </section>

    <section id="faq" class="landing__section">
      <div class="landing__section-head"><h2>常见问题</h2><p class="landing__section-sub">关于本项目的快速答案</p></div>
      <div class="landing__grid">${faqCards}</div>
    </section>

    <section class="landing__final">
      <h2>本周的技术动向，已经帮你整理好了</h2>
      <p>打开数据站按评分浏览、按日历回溯，或在阅读器里订阅每周 RSS。</p>
      <div class="landing__actions landing__actions--center">
        <a class="landing__cta" href="#entries">进入数据站</a>
        <a class="landing__cta landing__cta--ghost" href="${REPO_URL}" rel="noreferrer">查看 GitHub 仓库</a>
      </div>
    </section>
  </main>

  <footer class="landing__footer">
    <div class="landing__footer-main">
      <div class="landing__footer-brand">
        <img class="landing__footer-logo" src="${SITE}favicon.svg" alt="" width="28" height="28" />
        <div><strong>${SITE_TITLE}</strong><span class="landing__footer-en">${SITE_NAME}</span></div>
      </div>
      <p class="landing__footer-desc">${escapeHtml(FOOTER_DESC)}</p>
    </div>
    <div class="landing__footer-cols">
      <nav class="landing__footer-col" aria-label="产品入口">
        <h4>产品</h4>
        <a href="#entries">数据站 · 条目检索</a>
        <a href="#markdown">Markdown 周报</a>
        <a href="${SITE}about.html">关于本项目</a>
        <a href="${SITE}feed.xml">RSS 订阅源</a>
      </nav>
      <nav class="landing__footer-col" aria-label="项目资源">
        <h4>资源</h4>
        <a href="${REPO_URL}" rel="noreferrer">GitHub 仓库</a>
        <a href="${latestLink}">最新一期周报</a>
        <a href="${SITE}llms.txt">llms.txt</a>
        <a href="${SITE}llms-full.txt">llms-full.txt</a>
        <a href="${SITE}sitemap.xml">sitemap.xml</a>
        <a href="${SITE}viewer-data.json">viewer-data.json</a>
      </nav>
      <div class="landing__footer-col">
        <h4>说明</h4>
        <p>条目均来自公开信息源，AI 摘要与评分由大模型生成、仅供参考；项目为个人维护的非商业开源项目。</p>
      </div>
    </div>
    <div class="landing__footer-bottom">
      <span>© ${year} ${SITE_NAME}</span>
      <span>GitHub Actions 每周五自动构建 · GitHub Pages 托管</span>
    </div>
  </footer>
</div>
<!--seo-static-end-->`;
}

function buildHomeJsonLd({ stats }) {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE}#website`,
        url: SITE,
        name: `${SITE_TITLE}（${SITE_NAME}）`,
        alternateName: SITE_NAME,
        description: SITE_DEFINITION,
        inLanguage: "zh-CN",
        publisher: { "@id": `${SITE}#org` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE}#entries?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE}#org`,
        name: SITE_NAME,
        url: SITE,
        logo: { "@type": "ImageObject", url: `${SITE}icon-512.png` },
        description: FOOTER_DESC,
        sameAs: [REPO_URL],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE}#faq`,
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(graph, null, 1)}</script>`;
}

function injectHomeHtml(distIndex, data) {
  let html = fs.readFileSync(distIndex, "utf-8");

  // 幂等：移除上一次注入
  html = html
    .replace(/<!--seo-head-start-->[\s\S]*?<!--seo-head-end-->\s*/g, "")
    .replace(/<!--seo-static-start-->[\s\S]*?<!--seo-static-end-->\s*/g, "");

  const head = `<!--seo-head-start-->
<link rel="canonical" href="${SITE}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${SITE_TITLE} ${SITE_NAME}" />
<meta property="og:title" content="tech-digest · 中文 AI 技术周报与多源技术情报归档" />
<meta property="og:description" content="${escapeHtml(SITE_DEFINITION)}" />
<meta property="og:url" content="${SITE}" />
<meta property="og:image" content="${SITE}icon-512.png" />
<meta property="og:locale" content="zh_CN" />
<meta name="twitter:card" content="summary" />
${buildHomeJsonLd(data)}
<!--seo-head-end-->`;

  html = html.replace("</head>", `${head}\n  </head>`);

  const staticBody = buildLandingStatic(data);
  if (/<div id="root">\s*<\/div>/.test(html)) {
    html = html.replace(/<div id="root">\s*<\/div>/, `<div id="root">\n    ${staticBody}\n  </div>`);
  } else {
    html = html.replace(/<div id="root"><\/div>/, `<div id="root">\n    ${staticBody}\n  </div>`);
  }

  fs.writeFileSync(distIndex, html, "utf-8");
}

/* ---------- 2. 每期周报独立静态页 ---------- */

const REPORT_PAGE_CSS = `
:root { color-scheme: dark light; }
* { box-sizing: border-box; }
body { margin: 0; background: #111; color: #f0f0f0; font: 16px/1.75 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif; }
@media (prefers-color-scheme: light) { body { background: #fafafa; color: #1c1c1c; } }
.wrap { max-width: 880px; margin: 0 auto; padding: 32px 20px 64px; }
.crumb { font-size: 14px; margin-bottom: 20px; }
.crumb a { color: #3dd6c3; text-decoration: none; }
.crumb a:hover { text-decoration: underline; }
h1 { font-size: 1.7em; line-height: 1.3; margin: 0 0 8px; }
.meta { color: #8b9bab; font-size: 14px; margin-bottom: 28px; }
.meta span { margin-right: 14px; }
.article h2 { font-size: 1.35em; margin: 2em 0 .6em; border-bottom: 1px solid rgba(128,128,128,.25); padding-bottom: .3em; }
.article h3 { font-size: 1.15em; margin: 1.6em 0 .5em; }
.article p { margin: .7em 0; overflow-wrap: break-word; }
.article a { color: #3dd6c3; }
.article blockquote { margin: 1em 0; padding: .6em 1em; border-left: 3px solid #3dd6c3; background: rgba(128,128,128,.08); border-radius: 4px; color: rgba(200,210,220,.9); }
@media (prefers-color-scheme: light) { .article blockquote { color: #4a5560; } }
.article table { border-collapse: collapse; width: 100%; font-size: 14px; margin: 1em 0; display: block; overflow-x: auto; }
.article th, .article td { border: 1px solid rgba(128,128,128,.3); padding: 6px 10px; text-align: left; vertical-align: top; }
.article th { background: rgba(128,128,128,.1); }
.article code { background: rgba(128,128,128,.15); padding: 1px 5px; border-radius: 4px; font-size: .9em; }
.article hr { border: none; border-top: 1px solid rgba(128,128,128,.25); margin: 2em 0; }
.foot { margin-top: 48px; padding-top: 20px; border-top: 1px solid rgba(128,128,128,.2); color: #8b9bab; font-size: 14px; }
.foot a { color: #3dd6c3; text-decoration: none; }
.foot a:hover { text-decoration: underline; }
`;

function buildReportPage(d, sourceCounts, digestEntries) {
  const url = reportUrl(d.slug);
  const title = digestTitle(d);
  const desc = plainDescription(d.markdownBody, d, digestEntries);
  const published = isoDate(d.dateEnd || d.dateStart || d.crawlDate);
  const modified = isoDate(d.crawlDate || d.updatedAt);
  const bodyHtml = simpleMarkdownToHtml(d.markdownBody);
  const metaBits = [
    d.dateStart && d.dateEnd ? `时间窗 ${d.dateStart} ~ ${d.dateEnd}` : "",
    d.entryCount ? `${d.entryCount} 条条目` : "",
    d.crawlDate ? `抓取于 ${d.crawlDate}` : "",
    ...Object.entries(sourceCounts).map(([s, c]) => `${escapeHtml(s)} ${c}`),
  ].filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: desc,
    datePublished: published,
    dateModified: modified,
    inLanguage: "zh-CN",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: SITE_NAME, url: SITE },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE}icon-512.png` },
    },
    image: `${SITE}icon-512.png`,
    isPartOf: { "@id": `${SITE}#website` },
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)} · ${SITE_NAME}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}icon-512.png" />
<meta property="og:locale" content="zh_CN" />
<meta property="article:published_time" content="${published}" />
<meta property="article:modified_time" content="${modified}" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>${REPORT_PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
  <p class="crumb"><a href="${SITE}">← tech-digest · 技术周报归档</a></p>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${metaBits.map((m) => `<span>${m}</span>`).join("")}</p>
  <article class="article">
${bodyHtml}
  </article>
  <div class="foot">
    <p>本文为 <a href="${SITE}">${SITE_TITLE}（${SITE_NAME}）</a>的周报存档全文（${d.entryCount || "—"} 条条目）。每周五自动更新，
    可通过 <a href="${SITE}feed.xml">RSS 订阅</a>获取每期全文，或在 <a href="${SITE}#entries">数据站</a>检索全部历史条目。</p>
    <p>引用请注明来源：<a href="${url}">${url}</a></p>
  </div>
</div>
</body>
</html>
`;
}

function buildReportPages({ digests, entries }) {
  const byDigest = new Map();
  for (const e of entries) {
    if (!e.digestSlug) continue;
    const list = byDigest.get(e.digestSlug) ?? [];
    list.push(e);
    byDigest.set(e.digestSlug, list);
  }
  const SOURCE_LABELS = {
    arxiv: "arXiv",
    semantic_scholar: "Semantic Scholar",
    openalex: "OpenAlex",
    github_weekly: "GitHub 周榜",
    github_search: "GitHub 检索",
    rss: "RSS",
  };
  const outDir = path.join(DIST, "reports");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let n = 0;
  for (const d of digests) {
    const digestEntries = byDigest.get(d.slug) ?? [];
    const counts = {};
    for (const e of digestEntries) {
      if (!e.source) continue;
      counts[SOURCE_LABELS[e.source] ?? e.source] = (counts[SOURCE_LABELS[e.source] ?? e.source] ?? 0) + 1;
    }
    fs.writeFileSync(path.join(outDir, `${d.slug}.html`), buildReportPage(d, counts, digestEntries), "utf-8");
    n += 1;
  }
  return n;
}

/* ---------- 3. about.html ---------- */

function buildAboutPage({ stats }) {
  const url = `${SITE}about.html`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${url}#aboutpage`,
        url,
        name: `关于 ${SITE_NAME}`,
        inLanguage: "zh-CN",
        mainEntity: { "@id": `${SITE}#org` },
        isPartOf: { "@id": `${SITE}#website` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE}#org`,
        name: SITE_NAME,
        url: SITE,
        logo: { "@type": "ImageObject", url: `${SITE}icon-512.png` },
        description: SITE_DEFINITION,
        sameAs: [REPO_URL],
      },
    ],
  };

  const aboutBody = `
<h1>关于 tech-digest（技术周报归档）</h1>
<p class="lead">${escapeHtml(SITE_DEFINITION)}</p>
<h2>项目定位</h2>
<p>tech-digest 是一个开源的自动化技术情报管线与中文 AI 技术周报档案站：Python 完成多源采集与 GLM 摘要评分，条目按 Schema v1 落盘为 JSON 归档，React 档案站提供检索 / 日历 / Markdown 阅读，GitHub Actions 定时构建并发布至 GitHub Pages。</p>
<h2>数据来源</h2>
<ul>
  <li>arXiv —— 前沿论文速递（按关键词与时间窗检索）</li>
  <li>Semantic Scholar —— 学术论文与引用数据</li>
  <li>OpenAlex —— 开放学术数据</li>
  <li>GitHub Trending —— 开源项目周榜趋势</li>
  <li>GitHub Search —— 关键词仓库检索</li>
  <li>RSS —— 自定义技术资讯订阅源</li>
</ul>
<h2>产出与规模</h2>
<p>截至 ${isoDate(stats.generatedAt)}，已归档 <strong>${stats.runs}</strong> 期周报、<strong>${stats.entries}</strong> 条情报条目，覆盖 ${stats.sources} 类公开信息源；每周五 UTC 12:00 自动更新。</p>
<h2>维护者</h2>
<p>个人维护的非商业开源项目（GitHub：<a href="${REPO_URL}">yjmm10/tech-digest</a>）。条目均来自公开信息源，AI 摘要与评分由大模型生成、仅供参考。</p>
<h2>入口</h2>
<ul>
  <li><a href="${SITE}">首页与数据站</a></li>
  <li><a href="${SITE}feed.xml">RSS 订阅（每期全文）</a></li>
  <li><a href="${SITE}viewer-data.json">结构化数据 viewer-data.json（Schema v1）</a></li>
  <li><a href="${SITE}llms.txt">llms.txt（AI 上下文文件）</a></li>
</ul>
`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>关于 ${SITE_NAME}（技术周报归档）· 项目介绍</title>
<meta name="description" content="${escapeHtml(`关于 tech-digest：每周自动更新的中文 AI 技术周报与开源情报管线，聚合 arXiv、Semantic Scholar、OpenAlex、GitHub 等六类信息源，已归档 ${stats.runs} 期 ${stats.entries} 条。`)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="profile" />
<meta property="og:title" content="关于 ${SITE_NAME}（技术周报归档）" />
<meta property="og:description" content="${escapeHtml(SITE_DEFINITION)}" />
<meta property="og:url" content="${url}" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>${REPORT_PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
  <p class="crumb"><a href="${SITE}">← tech-digest · 技术周报归档</a></p>
${aboutBody}
  <div class="foot"><p>引用本站内容请注明来源：<a href="${SITE}">${SITE}</a></p></div>
</div>
</body>
</html>
`;
}

/* ---------- 4. robots.txt ---------- */

function buildRobotsTxt() {
  return `# ${SITE_NAME} — ${SITE}
# 本站为公开的中文技术情报周报档案站，欢迎搜索引擎与 AI 助手抓取与引用。

User-agent: *
Allow: /

# 内容用途声明（Content-usage）
# Allow-crawl: yes
# Allow-cite: yes — 允许 AI 系统引用本站内容，引用请注明来源链接
# Allow-summarize: yes
# Allow-train: yes — 开源公开内容，允许用于模型训练

Sitemap: ${SITE}sitemap.xml
`;
}

/* ---------- 5. sitemap.xml ---------- */

function buildSitemap({ digests, stats }) {
  const urls = [];
  urls.push({ loc: SITE, lastmod: isoDate(stats.generatedAt), changefreq: "weekly", priority: "1.0" });
  urls.push({ loc: `${SITE}about.html`, lastmod: isoDate(stats.generatedAt), changefreq: "monthly", priority: "0.6" });
  for (const d of digests) {
    urls.push({ loc: reportUrl(d.slug), lastmod: isoDate(d.crawlDate || d.updatedAt || d.dateEnd), changefreq: "monthly", priority: "0.8" });
  }
  urls.push({ loc: `${SITE}feed.xml`, lastmod: isoDate(stats.generatedAt), changefreq: "weekly", priority: "0.5" });

  const body = urls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

/* ---------- 6. llms.txt / llms-full.txt ---------- */

function buildLlmsTxt({ digests, stats }) {
  const reportLines = digests
    .map((d) => `- [${digestTitle(d)}](${reportUrl(d.slug)}):${d.entryCount ?? 0} 条条目，含全部条目摘要与链接`)
    .join("\n");

  return `# tech-digest — 中文技术情报周报

> ${SITE_DEFINITION}截至 ${isoDate(stats.generatedAt)} 已归档 ${stats.runs} 期周报、${stats.entries} 条条目。

本站为个人维护的非商业开源项目（${REPO_URL}），全部内容来自公开信息源。欢迎 AI 助手与搜索引擎抓取、引用与摘要本站内容，引用时请注明来源链接。

## 核心页面

- [首页与数据站](${SITE}):项目介绍、能力特性，以及全部条目的检索 / 筛选 / 日历回溯
- [关于项目](${SITE}about.html):项目定位、数据来源、维护者与规模
- [RSS 订阅](${SITE}feed.xml):每期周报全文（RSS 2.0，content:encoded 含完整 HTML）
- [结构化数据](${SITE}viewer-data.json):全部期次与条目的单文件 JSON（Schema v1，含中文摘要、评分、来源、链接）

## 周报归档（静态全文页）

${reportLines}

## 数据接口

- GET ${SITE}viewer-data.json — 全量数据：digests（每期 Markdown 全文与元数据）+ entries（逐条中文摘要、0–10 评分、原文链接、标签）
- GET ${SITE}data/runs/<runId>.json — 每期独立归档（Schema v1）
- GET ${SITE}llms-full.txt — 全站文本（本文件 + 全部周报全文 + 关于页）
`;
}

function buildLlmsFullTxt({ digests, stats }) {
  const parts = [];
  parts.push(`# tech-digest — 全站文本（${SITE}）

> ${SITE_DEFINITION}本文件为整站内容的单文件版本：首页文案、关于页与全部周报全文。截至 ${isoDate(stats.generatedAt)}：${stats.runs} 期周报、${stats.entries} 条条目。
`);

  parts.push(`## 首页与项目文案

### 项目定义

${SITE_DEFINITION}

### 落地页导语

${SITE_LEAD}

### 能力特性

${FEATURES.map((f) => `- **${f.title}**：${f.desc}`).join("\n")}

### 运作方式

${STEPS.map((s) => `${s.n}. ${s.title}：${s.desc}`).join("\n")}

### 常见问题

${FAQ.map((f) => `**${f.q}**\n${f.a}`).join("\n\n")}
`);

  parts.push(`## 关于项目

tech-digest 是一个开源的自动化技术情报管线与中文 AI 技术周报档案站：Python 完成多源采集与 GLM 摘要评分，条目按 Schema v1 落盘为 JSON 归档，React 档案站提供检索 / 日历 / Markdown 阅读，GitHub Actions 每周五 UTC 12:00 定时构建并发布至 GitHub Pages。个人维护的非商业开源项目（${REPO_URL}），条目均来自公开信息源，AI 摘要与评分由大模型生成、仅供参考。
`);

  for (const d of digests) {
    const srcBits = (d.sections ?? [])
      .filter((s) => s.entryCount > 0)
      .map((s) => `${s.heading} ${s.entryCount} 条`)
      .join("、");
    parts.push(`## ${digestTitle(d)}

- 存档页：${reportUrl(d.slug)}
- 时间窗：${d.dateStart ?? "?"} ~ ${d.dateEnd ?? "?"} · 抓取：${d.crawlDate ?? "?"} · 条目：${d.entryCount ?? 0}${srcBits ? `（${srcBits}）` : ""}

${String(d.markdownBody).trim()}
`);
  }

  return parts.join("\n");
}

/* ---------- main ---------- */

function main() {
  if (!fs.existsSync(DIST)) {
    console.error("build-static-seo: dist/ not found; run after `vite build`.");
    process.exit(1);
  }
  const data = loadData();
  const distIndex = path.join(DIST, "index.html");
  if (!fs.existsSync(distIndex)) {
    console.error("build-static-seo: dist/index.html not found.");
    process.exit(1);
  }

  injectHomeHtml(distIndex, data);
  const reports = buildReportPages(data);
  fs.writeFileSync(path.join(DIST, "about.html"), buildAboutPage(data), "utf-8");
  fs.writeFileSync(path.join(DIST, "robots.txt"), buildRobotsTxt(), "utf-8");
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), buildSitemap(data), "utf-8");
  fs.writeFileSync(path.join(DIST, "llms.txt"), buildLlmsTxt(data), "utf-8");
  fs.writeFileSync(path.join(DIST, "llms-full.txt"), buildLlmsFullTxt(data), "utf-8");

  const kb = (p) => `${(fs.statSync(p).size / 1024).toFixed(1)}KB`;
  console.log(
    `build-static-seo: home static snapshot injected · ${reports} report pages · about.html · robots.txt · sitemap.xml · llms.txt (${kb(path.join(DIST, "llms.txt"))}) · llms-full.txt (${kb(path.join(DIST, "llms-full.txt"))})`,
  );
}

main();
