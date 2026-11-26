import { useEffect, useRef, useState } from "react";
import "./LandingPage.css";

const REPO_URL = "https://github.com/yjmm10/tech-digest";
const SITE_URL = "https://yjmm10.github.io/tech-digest/";
const feedUrl = `${import.meta.env.BASE_URL}feed.xml`;

interface SiteStats {
  runs?: number;
  entries?: number;
  sources?: number;
  generatedAt?: string;
}

/** 首屏预览框里的示例条目（取自站内真实数据） */
const PREVIEW_ROWS = [
  {
    source: "GH 周榜",
    sourceClass: "github_weekly",
    title: "3b1b/manim",
    desc: "精确程序化数字动画引擎，3Blue1Brown 出品",
    tags: ["数学动画", "Python", "可视化"],
    score: 10,
  },
  {
    source: "OpenAlex",
    sourceClass: "openalex",
    title: "RecoverFly: A Failure-Aware Reinforcement Learning Post-…",
    desc: "面向 UAV 视觉-语言导航的失败感知 RL 后训练框架，让智能体从执行错误中恢复",
    tags: ["UAV", "VLN", "强化学习"],
    score: 10,
  },
  {
    source: "GH 检索",
    sourceClass: "github_search",
    title: "alexpalms/deeprl-counter-uav-swarm",
    desc: "强化学习框架，用于决策级无人机集群拦截优先级排序",
    tags: ["无人机集群", "RL", "拦截决策"],
    score: 9,
  },
  {
    source: "Arxiv",
    sourceClass: "arxiv",
    title: "FIRE-VLM: A Vision-Language-Driven Reinforcement Learning…",
    desc: "视觉-语言模型驱动的强化学习新范式",
    tags: ["视觉语言", "强化学习"],
    score: 9,
  },
];

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

function FeatureIcon({ name }: { name: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "sources":
      return (
        <svg {...common}>
          <path d="M12 3 3 8l9 5 9-5-9-5Z" />
          <path d="m3 13 9 5 9-5" opacity="0.55" />
        </svg>
      );
    case "ai":
      return (
        <svg {...common}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      );
    case "dedup":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="12" height="12" rx="2" opacity="0.5" />
          <rect x="9" y="9" width="12" height="12" rx="2" />
        </svg>
      );
    case "filter":
      return (
        <svg {...common}>
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
      );
    case "schema":
      return (
        <svg {...common}>
          <path d="M6 3h9l4 4v14l-4-2.5L11 21l-5-2.5V3Z" />
          <path d="M9 9h6M9 13h6" opacity="0.6" />
        </svg>
      );
    case "publish":
      return (
        <svg {...common}>
          <path d="M4.5 11.5a8 8 0 0 1 8 8M4.5 5.5a14 14 0 0 1 14 14" />
          <circle cx="5.5" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="m8.5 7-4.5 5 4.5 5M15.5 7l4.5 5-4.5 5M13 5l-2.5 14" />
        </svg>
      );
  }
}

/** 数字滚动：进入视口后从 0 计数到目标值（尊重 prefers-reduced-motion） */
function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !started.current) {
          started.current = true;
          io.disconnect();
          const t0 = performance.now();
          const dur = 900;
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / dur);
            setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return <span ref={ref}>{display}</span>;
}

export default function LandingPage({
  onEnter,
}: {
  onEnter: () => void;
}) {
  const [stats, setStats] = useState<SiteStats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}stats.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: SiteStats | null) => {
        if (alive && j) setStats(j);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 滚动渐显：单个 IntersectionObserver 驱动全部 [data-reveal] 元素
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const year = new Date().getFullYear();

  return (
    <div className="landing">

      <main>
        <section className="landing__hero">
          <div className="landing__aurora" aria-hidden="true">
            <span className="landing__aurora-blob landing__aurora-blob--a" />
            <span className="landing__aurora-blob landing__aurora-blob--b" />
          </div>

          <div className="landing__hero-copy">
            <span className="landing__badge">
              <span className="landing__badge-dot" aria-hidden="true" />
              开源项目 · 每周五自动更新
            </span>
            <h1>
              把散落的技术情报
              <br />
              收进<em>一份周报</em>
            </h1>
            <p className="landing__lead">
              基于 GitHub Actions 定时抓取 arXiv、Semantic Scholar、OpenAlex、GitHub
              趋势/检索与 RSS 六类公开信息源，由 GLM 大模型生成中文摘要与相关性评分，
              经三级去重后结构化归档，支持全文检索、日历回溯与 RSS 订阅。
            </p>
            <div className="landing__actions">
              <button type="button" className="landing__cta" onClick={onEnter}>
                进入数据站
              </button>
              <a className="landing__cta landing__cta--ghost" href={feedUrl}>
                订阅 RSS
              </a>
            </div>
            {stats && (
              <p className="landing__fact">
                已归档 <strong>{stats.runs ?? "—"}</strong> 期 ·{" "}
                <strong>{stats.entries ?? "—"}</strong> 条 · 覆盖{" "}
                <strong>{stats.sources ?? "—"}</strong> 类来源
              </p>
            )}
          </div>

          <div className="landing__frame" aria-hidden="true">
            <div className="af">
              <div className="af__bar">
                <span className="af__dot" />
                <span className="af__dot" />
                <span className="af__dot" />
                <span className="af__title">技术周报归档 · 数据站</span>
              </div>
              <div className="af__filter">
                <span className="af__search">搜索条目、标签、仓库…</span>
                <span className="af__chip">评分</span>
                <span className="af__chip af__chip--on">全部</span>
              </div>
              <div className="af__rows">
                {PREVIEW_ROWS.map((r) => (
                  <div className="af__row" key={r.title}>
                    <div className="af__row-top">
                      <span className={`af__src af__src--${r.sourceClass}`}>{r.source}</span>
                      <span className="af__score">{r.score}</span>
                    </div>
                    <div className="af__row-title">{r.title}</div>
                    <div className="af__row-desc">{r.desc}</div>
                    <div className="af__row-tags">
                      {r.tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="landing__marquee" aria-hidden="true">
          <div className="landing__marquee-track">
            {[0, 1].map((copy) => (
              <div className="landing__marquee-group" key={copy}>
                {SOURCES.map((s) => (
                  <span className={`landing__source-chip landing__source-chip--${s.cls}`} key={s.name}>
                    {s.name}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section id="features" className="landing__section">
          <div className="landing__section-head" data-reveal>
            <h2>能力特性</h2>
            <p className="landing__section-sub">一套可自部署的技术情报自动化管线</p>
          </div>
          <div className="landing__grid">
            {FEATURES.map((f, i) => (
              <article
                className="landing__card"
                key={f.key}
                data-reveal
                style={{ transitionDelay: `${(i % 3) * 70}ms` }}
              >
                <span className="landing__card-icon">
                  <FeatureIcon name={f.key} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="landing__section">
          <div className="landing__section-head" data-reveal>
            <h2>运作方式</h2>
            <p className="landing__section-sub">从信息源到归档发布，全流程由 CI 自动完成</p>
          </div>
          <ol className="landing__steps">
            {STEPS.map((s, i) => (
              <li
                className="landing__step"
                key={s.n}
                data-reveal
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <span className="landing__step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing__band-wrap">
          <div className="landing__band" data-reveal>
            <div className="landing__band-item">
              <strong>{stats ? <CountUp value={stats.runs ?? 0} /> : "—"}</strong>
              <span>期定时抓取</span>
            </div>
            <div className="landing__band-item">
              <strong>{stats ? <CountUp value={stats.entries ?? 0} /> : "—"}</strong>
              <span>条情报条目</span>
            </div>
            <div className="landing__band-item">
              <strong>{stats ? <CountUp value={stats.sources ?? 0} /> : "—"}</strong>
              <span>类公开信息源</span>
            </div>
            <div className="landing__band-item">
              <strong>每周</strong>
              <span>定时更新</span>
            </div>
          </div>
        </section>

        <section className="landing__final" data-reveal>
          <h2>本周的技术动向，已经帮你整理好了</h2>
          <p>打开数据站按评分浏览、按日历回溯，或在阅读器里订阅每周 RSS。</p>
          <div className="landing__actions landing__actions--center">
            <button type="button" className="landing__cta" onClick={onEnter}>
              进入数据站
            </button>
            <a className="landing__cta landing__cta--ghost" href={REPO_URL} target="_blank" rel="noreferrer">
              查看 GitHub 仓库
            </a>
          </div>
        </section>
      </main>

      <footer className="landing__footer">
        <div className="landing__footer-main">
          <div className="landing__footer-brand">
            <img
              className="landing__footer-logo"
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt=""
              width={28}
              height={28}
            />
            <div>
              <strong>技术周报归档</strong>
              <span className="landing__footer-en">tech-digest</span>
            </div>
          </div>
          <p className="landing__footer-desc">
            多源技术情报抓取与 AI 汇总的开源自动化管线：Python 完成采集与 GLM
            摘要评分，条目按 Schema v1 落盘为 JSON 归档，React 档案站提供检索 /
            日历 / Markdown 阅读，GitHub Actions 定时构建并发布至 GitHub Pages。
          </p>
        </div>

        <div className="landing__footer-cols">
          <nav className="landing__footer-col" aria-label="产品入口">
            <h4>产品</h4>
            <a href="#entries">数据站 · 条目检索</a>
            <a href="#markdown">Markdown 周报</a>
            <a href="#about">关于本项目</a>
            <a href={feedUrl}>RSS 订阅源</a>
          </nav>
          <nav className="landing__footer-col" aria-label="项目资源">
            <h4>资源</h4>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub 仓库
            </a>
            <a href={SITE_URL} target="_blank" rel="noreferrer">
              线上站点
            </a>
            <a href={SITE_URL + "feed.xml"} target="_blank" rel="noreferrer">
              feed.xml
            </a>
          </nav>
          <div className="landing__footer-col">
            <h4>说明</h4>
            <p>
              条目均来自公开信息源，AI 摘要与评分由大模型生成、仅供参考；
              项目为个人维护的非商业开源项目。
            </p>
          </div>
        </div>

        <div className="landing__footer-bottom">
          <span>© {year} tech-digest</span>
          <span>GitHub Actions 每周五自动构建 · GitHub Pages 托管</span>
        </div>
      </footer>
    </div>
  );
}
