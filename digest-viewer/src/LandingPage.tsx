import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import ViewTabs from "./ViewTabs";
import "./LandingPage.css";

const REPO_URL = "https://github.com/yjmm10/tech-digest";
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

const FEATURES = [
  {
    key: "sources",
    title: "多源聚合",
    desc: "Arxiv、Semantic Scholar、OpenAlex、技术 RSS 与 GitHub 趋势/检索，一站汇合，不用再挨个翻。",
  },
  {
    key: "ai",
    title: "AI 摘要与评分",
    desc: "每条自动生成中文摘要与相关性评分，先看重点，再决定要不要点开原文。",
  },
  {
    key: "calendar",
    title: "日历回溯",
    desc: "按发表/抓取日期翻查任意一天的历史归档，错过哪周就补哪周。",
  },
  {
    key: "favorite",
    title: "收藏与导出",
    desc: "本地收藏夹不丢条目，筛选结果一键导出 Markdown 列表。",
  },
  {
    key: "rss",
    title: "RSS 订阅",
    desc: "每周自动生成 RSS 源，在阅读器或邮件里直接追更。",
  },
  {
    key: "opensource",
    title: "开源可自部署",
    desc: "采集管线、数据构建与前端全部开源，fork 下来就能跑自己的周报。",
  },
];

const STEPS = [
  { n: "01", title: "定时抓取", desc: "按排程抓取多个公开信息源的最新内容" },
  { n: "02", title: "清洗去重", desc: "同期次与跨期按链接、标题去重，只留有效条目" },
  { n: "03", title: "AI 摘要评分", desc: "生成中文摘要与相关性评分，标注来源与日期" },
  { n: "04", title: "归档发布", desc: "生成周报页面、结构化 JSON 与 RSS，长期可回溯" },
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
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      );
    case "favorite":
      return (
        <svg {...common}>
          <path d="m12 20.5-7.5-7.4a4.9 4.9 0 0 1 0-7 4.6 4.6 0 0 1 6.6 0l.9.9.9-.9a4.6 4.6 0 0 1 6.6 0 4.9 4.9 0 0 1 0 7Z" />
        </svg>
      );
    case "rss":
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

export default function LandingPage({
  onEnter,
  onOpenMarkdown,
  onOpenAbout,
}: {
  onEnter: () => void;
  onOpenMarkdown: () => void;
  onOpenAbout: () => void;
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

  return (
    <div className="landing">
      <header className="landing__nav">
        <a className="landing__brand" href="#/">
          <img
            className="landing__logo"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            width={30}
            height={30}
          />
          <span>技术周报归档</span>
        </a>
        <ViewTabs
          className="landing__tabs"
          active={null}
          onNavigate={(view) => {
            if (view === "entries") onEnter();
            else if (view === "markdown") onOpenMarkdown();
            else onOpenAbout();
          }}
        />
        <div className="landing__nav-actions">
          <ThemeToggle />
          <button type="button" className="landing__cta landing__cta--sm" onClick={onEnter}>
            进入数据站
          </button>
        </div>
      </header>

      <main>
        <section className="landing__hero">
          <div className="landing__hero-copy">
            <span className="landing__badge">开源 · 每周定时更新</span>
            <h1>
              把散落的技术情报
              <br />
              收进<em>一份周报</em>
            </h1>
            <p className="landing__lead">
              聚合 Arxiv、Semantic Scholar、OpenAlex、技术 RSS 与 GitHub
              趋势，AI 生成中文摘要与相关性评分，按周归档、可检索、可订阅。
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

        <section id="features" className="landing__section">
          <h2>功能特性</h2>
          <p className="landing__section-sub">为每周只想要半小时信息摄入的人准备</p>
          <div className="landing__grid">
            {FEATURES.map((f) => (
              <article className="landing__card" key={f.key}>
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
          <h2>运作方式</h2>
          <p className="landing__section-sub">从信息源到归档，全流程自动完成</p>
          <ol className="landing__steps">
            {STEPS.map((s) => (
              <li className="landing__step" key={s.n}>
                <span className="landing__step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing__band">
          <div className="landing__band-item">
            <strong>{stats?.runs ?? "—"}</strong>
            <span>期归档</span>
          </div>
          <div className="landing__band-item">
            <strong>{stats?.entries ?? "—"}</strong>
            <span>条情报</span>
          </div>
          <div className="landing__band-item">
            <strong>{stats?.sources ?? "—"}</strong>
            <span>类来源</span>
          </div>
          <div className="landing__band-item">
            <strong>每周</strong>
            <span>定时更新</span>
          </div>
        </section>

        <section className="landing__final">
          <h2>本周的技术动向，已经帮你整理好了</h2>
          <p>打开数据站，按分数浏览、按日期回溯，或直接订阅 RSS。</p>
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
        <span>技术周报归档 · 个人独立运营的非商业开源项目</span>
        <nav aria-label="页脚链接">
          <a href="#features">功能</a>
          <a href="#how">运作方式</a>
          <a href="#about">关于</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={feedUrl}>RSS</a>
        </nav>
      </footer>
    </div>
  );
}
