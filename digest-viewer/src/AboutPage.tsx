import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import "./AboutPage.css";

/**
 * 关于页：作者名片数据同步自个人主页 yjmm10.github.io（profile.json / projects.json）。
 * 调用方式对齐 fj-starmap 关于页：内置快照同步首绘（无跳动），挂载后拉取最新数据
 * 渲染，拉取失败时兜底使用内置快照。本站部署于 yjmm10.github.io，直连即同源；
 * GitHub Pages 静态资源带 CORS 头，本地开发亦可跨源拉取。
 */

const PROFILE_URL = "https://yjmm10.github.io/profile.json";
const PROJECTS_URL = "https://yjmm10.github.io/projects.json";
const REPO_URL = "https://github.com/yjmm10/tech-digest";

type Bilingual = string | { en?: string; zh?: string } | null | undefined;

interface RawProfile {
  name?: string;
  handle?: string;
  role?: Bilingual;
  avatar?: string;
  avatar_alt?: string;
  website?: string;
  slogan?: Bilingual;
  skills?: { category?: Bilingual; items?: Bilingual[] }[];
  thoughts?: Bilingual[];
  links?: Record<string, unknown>;
  updated?: string;
  [key: string]: unknown;
}

interface RawWipItem {
  name?: Bilingual;
  tagline?: Bilingual;
  status?: string;
}

interface SkillGroup {
  category: string;
  items: string[];
}

interface NormalizedLinks {
  github: string;
  email: string;
  wechatQr: string;
  rewardQr: string;
  extras: [string, string][];
}

interface NormalizedProfile {
  name: string;
  handle: string;
  role: string;
  avatar: string;
  avatarAlt: string;
  website: string;
  slogan: string;
  skills: SkillGroup[];
  thoughts: string[];
  links: NormalizedLinks;
  updated: string;
  extras: [string, unknown][];
}

interface WipItem {
  text: string;
  status: string;
}

/** 内置快照：与个人主页 profile.json 同步，拉取失败时兜底，保证首绘无跳动 */
const SNAPSHOT: NormalizedProfile = {
  name: "Lucas",
  handle: "yjmm10",
  role: "独立开发者",
  avatar: "https://yjmm10.github.io/assets/avatar.webp",
  avatarAlt: "https://yjmm10.github.io/assets/avatar-alt.webp",
  website: "https://yjmm10.github.io/",
  slogan: "技术是思考的延伸，而不是目的本身",
  skills: [
    {
      category: "智能文档处理",
      items: ["版面分析", "表格解析", "公式解析", "文字识别", "印章识别", "发票解析", "信息抽取", "文档理解", "文档结构化", "文档 RAG"],
    },
    { category: "生成式 AI 全链开发", items: ["提示词工程", "模型训练", "推理部署", "Agent 开发"] },
    { category: "无人机轨迹优化", items: ["任务卸载", "资源优化", "多机协同", "强化学习", "多目标优化"] },
  ],
  thoughts: ["小而完整，好过大而全。", "被真正用到，才算做完。", "反复打磨，是一种认真。"],
  links: {
    github: "https://github.com/yjmm10",
    email: "lucas4ai@outlook.com",
    wechatQr: "https://yjmm10.github.io/assets/wechat-qr.png",
    rewardQr: "https://yjmm10.github.io/assets/reward-qr.png",
    extras: [],
  },
  updated: "2026-11-20",
  extras: [],
};

/** 在搞的项目：取自个人主页 projects.json 的 wip 数组；拉取失败时兜底 */
const WIP_SNAPSHOT: WipItem[] = [
  { text: "DocVLM · 多模态文档智能解析", status: "in-progress" },
  { text: "fj-starmap · AI 创业政策追踪与洞察", status: "tinkering" },
  { text: "Glean · 跨平台内容全自动分发", status: "polishing" },
  { text: "Academic Skill · 科研效率工具集", status: "brewing" },
];

const STATUS: Record<string, string> = {
  "in-progress": "进行中",
  tinkering: "折腾中",
  polishing: "打磨中",
  brewing: "构思中",
  released: "已上线",
  archived: "已归档",
};

/** schema 已知字段；未列出的顶层/links 字段走通用渲染，保证新增内容不丢失 */
const KNOWN_KEYS = new Set([
  "$schema",
  "name",
  "handle",
  "role",
  "avatar",
  "avatar_alt",
  "website",
  "slogan",
  "expertise",
  "skills",
  "thoughts",
  "links",
  "updated",
]);
const KNOWN_LINK_KEYS = new Set(["github", "email", "wechat_qr", "reward_qr"]);

function pick(o: Bilingual): string {
  if (o == null) return "";
  if (typeof o === "string") return o;
  return o.zh || o.en || "";
}

function bi(o: Bilingual): string {
  const p = pick(o);
  if (p) return p;
  if (o && typeof o === "object") {
    return Object.values(o)
      .filter((v): v is string => typeof v === "string")
      .join(" · ");
  }
  return typeof o === "string" ? o : "";
}

function normalize(d: RawProfile, fb: NormalizedProfile): NormalizedProfile {
  const links = d.links ?? {};
  const str = (v: unknown): string => (typeof v === "string" ? v : "");

  const linkExtras: [string, string][] = [];
  Object.keys(links).forEach((k) => {
    if (!KNOWN_LINK_KEYS.has(k) && str(links[k])) linkExtras.push([k, str(links[k])]);
  });

  const extras: [string, unknown][] = [];
  Object.keys(d).forEach((k) => {
    if (!KNOWN_KEYS.has(k) && !k.startsWith("$") && d[k] != null) extras.push([k, d[k]]);
  });

  const skills =
    Array.isArray(d.skills) && d.skills.length
      ? d.skills
          .map((g) => ({
            category: pick(g?.category),
            items: Array.isArray(g?.items)
              ? g.items.map((it) => pick(it) || String(it ?? "")).filter(Boolean)
              : [],
          }))
          .filter((g) => g.category && g.items.length)
      : fb.skills;

  const thoughts =
    Array.isArray(d.thoughts) && d.thoughts.length
      ? d.thoughts.map((t) => pick(t) || String(t ?? "")).filter(Boolean)
      : fb.thoughts;

  return {
    name: d.name || fb.name,
    handle: d.handle || fb.handle,
    role: pick(d.role) || fb.role,
    avatar: d.avatar || fb.avatar,
    avatarAlt: d.avatar_alt || fb.avatarAlt,
    website: d.website || fb.website,
    slogan: pick(d.slogan) || fb.slogan,
    skills,
    thoughts,
    links: {
      github: str(links.github) || fb.links.github,
      email: str(links.email) || fb.links.email,
      wechatQr: str(links.wechat_qr) || fb.links.wechatQr,
      rewardQr: str(links.reward_qr) || fb.links.rewardQr,
      extras: linkExtras,
    },
    updated: d.updated || fb.updated,
    extras,
  };
}

/* thoughts 支持 **关键词** 加粗强调语法（schema 约定） */
function renderBold(text: string): ReactNode[] {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

/* ===== 图标 ===== */

function IconGithub() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
      <path d="m3.5 7.5 8.5 5.5 8.5-5.5" />
    </svg>
  );
}

function IconWechat() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.3 4C5.3 4 2 6.6 2 9.9c0 1.9 1.1 3.5 2.8 4.6L4 17l2.8-1.4c.8.3 1.7.4 2.5.4h.4a5.4 5.4 0 0 1-.2-1.5c0-2.9 2.7-5.2 6-5.2h.5C14.9 6 12.4 4 9.3 4Zm-2 4.2a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Zm4.6 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" />
      <path d="M22 14.6c0-2.5-2.5-4.6-5.5-4.6S11 12.1 11 14.6s2.5 4.6 5.5 4.6c.8 0 1.5-.1 2.2-.4l2.3 1.2-.6-2c1-.8 1.6-2 1.6-3.4Zm-7.2-.9a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm3.4 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z" />
    </svg>
  );
}

function IconCoffee() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z" />
      <path d="M8 3.5v2M11.5 3.5v2M15 3.5v2" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C12.9 6.9 17.1 11.1 24 12 17.1 12.9 12.9 17.1 12 24 11.1 17.1 6.9 12.9 0 12 6.9 11.1 11.1 6.9 12 0Z" />
    </svg>
  );
}

/* ===== 子组件 ===== */

/** 头像：双图点击切换，加载失败回退到首字母 */
function Portrait({ name, avatar, avatarAlt }: { name: string; avatar: string; avatarAlt: string }) {
  const urls = useMemo(() => Array.from(new Set([avatar, avatarAlt].filter(Boolean))), [avatar, avatarAlt]);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const multi = urls.length > 1;
  const src = urls[Math.min(idx, urls.length - 1)] ?? "";

  const toggle = () => {
    if (multi) setIdx((i) => (i + 1) % urls.length);
  };

  return (
    <figure
      className="lh-portrait"
      role={multi ? "button" : undefined}
      tabIndex={multi ? 0 : undefined}
      aria-label={multi ? "切换头像" : undefined}
      title={multi ? "点击切换头像" : undefined}
      onClick={toggle}
      onKeyDown={(e) => {
        if (multi && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          toggle();
        }
      }}
    >
      {failed || !src ? (
        <span className="lh-ava-letter" aria-hidden="true">
          {(name || "L").charAt(0).toUpperCase()}
        </span>
      ) : (
        <img
          src={src}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (idx + 1 < urls.length) setIdx(idx + 1);
            else setFailed(true);
          }}
        />
      )}
      {["s1", "s2", "s3"].map((c) => (
        <span key={c} className={`lh-sparkle ${c}`} aria-hidden="true">
          <IconSparkle />
        </span>
      ))}
    </figure>
  );
}

function QrPop({ cls, label, src }: { cls: string; label: string; src: string }) {
  return (
    <div className="lh-qr-pop">
      <button type="button" className={`lh-soc ${cls}`} aria-label={label} title={label}>
        {cls === "soc-wechat" ? <IconWechat /> : <IconCoffee />}
      </button>
      <figure className="lh-pop">
        <img src={src} alt={label} loading="lazy" referrerPolicy="no-referrer" />
        <figcaption>{label}</figcaption>
      </figure>
    </div>
  );
}

function SocialLinks({ links }: { links: NormalizedLinks }) {
  return (
    <div className="lh-social">
      <a className="lh-soc soc-github" href={links.github} target="_blank" rel="noopener" aria-label="GitHub" title="GitHub">
        <IconGithub />
      </a>
      <a className="lh-soc soc-mail" href={`mailto:${links.email}`} aria-label="邮箱" title={links.email}>
        <IconMail />
      </a>
      {links.wechatQr && <QrPop cls="soc-wechat" label="微信 · 加个好友" src={links.wechatQr} />}
      {links.rewardQr && <QrPop cls="soc-coffee" label="赞赏 · 请我喝咖啡" src={links.rewardQr} />}
      {links.extras.map(([key, url]) => (
        <a key={key} className="lh-soc" href={url} target="_blank" rel="noopener" aria-label={key} title={key}>
          {key}
        </a>
      ))}
    </div>
  );
}

/** 技能胶囊 + 悬停标签墙 */
function SkillWall({ skills }: { skills: SkillGroup[] }) {
  if (!skills.length) return null;
  return (
    <>
      <div className="lh-skill-label">擅 长 领 域</div>
      <div className="lh-skills">
        {skills.map((g) => (
          <div key={g.category} className="lh-skill-pop">
            <button type="button" className="lh-skill">
              {g.category}
            </button>
            <div className="lh-tip">
              <div className="lh-tip-tags">
                {g.items.map((it, i) => (
                  <span key={`${it}-${i}`}>{it}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function WipList({ items }: { items: WipItem[] }) {
  if (!items.length) return null;
  return (
    <section className="lh-wip">
      <h3 className="lh-col-title">在搞的项目</h3>
      <ul className="lh-wip-list">
        {items.map((p, i) => (
          <li key={`${p.text}-${i}`}>
            <span className="lh-dot" aria-hidden="true" />
            <span className="lh-wip-name">{p.text}</span>
            <em className={`lh-st${STATUS[p.status] ? ` st-${p.status}` : ""}`}>{STATUS[p.status] || p.status}</em>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Thoughts({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="lh-thoughts">
      <h3 className="lh-col-title">个人想法</h3>
      <ul className="lh-thought-list">
        {items.map((t, i) => (
          <li key={i}>{renderBold(t)}</li>
        ))}
      </ul>
    </section>
  );
}

/** 通用值渲染：字符串/链接/双语对象/数组一律转成可读内容，不做筛选 */
function GenericValue({ value }: { value: unknown }) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const tags = value
      .map((item) => (typeof item === "object" && item !== null ? bi(item as Bilingual) : String(item)))
      .filter(Boolean);
    if (!tags.length) return null;
    return (
      <div className="lh-tip-tags">
        {tags.map((t, i) => (
          <span key={`${t}-${i}`}>{t}</span>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    const txt = Object.values(value as Record<string, unknown>)
      .map((v) => (typeof v === "string" ? v : pick(v as Bilingual)))
      .filter(Boolean)
      .join(" · ");
    return txt ? <>{txt}</> : null;
  }
  if (/^https?:\/\//.test(String(value))) {
    return (
      <a href={String(value)} target="_blank" rel="noopener">
        {String(value)}
      </a>
    );
  }
  return <>{String(value)}</>;
}

function ExtrasSection({ extras }: { extras: [string, unknown][] }) {
  if (!extras.length) return null;
  return (
    <section className="lh-extras">
      {extras.map(([key, value]) => (
        <div key={key} className="lh-extra">
          <h3 className="lh-col-title">{key}</h3>
          <div className="lh-extra-val">
            <GenericValue value={value} />
          </div>
        </div>
      ))}
    </section>
  );
}

/* ===== 主组件 ===== */

export default function AboutPage() {
  const [rawProfile, setRawProfile] = useState<RawProfile | null>(null);
  const [wip, setWip] = useState<WipItem[]>(WIP_SNAPSHOT);

  useEffect(() => {
    let cancelled = false;
    async function loadJson<T>(url: string): Promise<T | null> {
      try {
        const r = await fetch(url, { credentials: "omit" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as T;
      } catch {
        return null;
      }
    }
    Promise.all([
      loadJson<RawProfile>(PROFILE_URL),
      loadJson<{ wip?: RawWipItem[] }>(PROJECTS_URL),
    ]).then(([profile, projects]) => {
      if (cancelled) return;
      if (profile) setRawProfile(profile);
      const list = Array.isArray(projects?.wip) ? projects.wip : [];
      if (list.length) {
        setWip(
          list.map((p) => ({
            text: [bi(p.name), bi(p.tagline)].filter(Boolean).join(" · "),
            status: p.status || "",
          })),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = useMemo(() => normalize(rawProfile ?? {}, SNAPSHOT), [rawProfile]);
  const feedUrl = `${import.meta.env.BASE_URL}feed.xml`;

  return (
    <div className="about-page">
      {/* 模块一：关于作者（个人主页 profile.json / projects.json 开放数据自动渲染） */}
      <section className="about-card author-panel">
        <div className="panel-head">
          <h2>👋 关于作者</h2>
        </div>
        <div className="lucas-hero">
          <div className="lh-me">
            <Portrait name={profile.name} avatar={profile.avatar} avatarAlt={profile.avatarAlt} />
            <div className="lh-name-row">
              <span className="lh-name">{profile.name}</span>
              {profile.handle && (
                <a
                  className="lh-handle"
                  href={profile.links.github || `https://github.com/${profile.handle}`}
                  target="_blank"
                  rel="noopener"
                >
                  @{profile.handle}
                </a>
              )}
            </div>
            <div className="lh-role">{profile.role}</div>
            <SocialLinks links={profile.links} />
            <SkillWall skills={profile.skills} />
          </div>

          <div className="lh-intro">
            {profile.slogan && (
              <p className="lh-slogan">
                <span className="lh-quote">❝ </span>
                {profile.slogan}
                <span className="lh-quote"> ❞</span>
              </p>
            )}
            <WipList items={wip} />
            <Thoughts items={profile.thoughts} />
            <ExtrasSection extras={profile.extras} />
          </div>
        </div>
      </section>

      {/* 模块二：关于本站（样式与其他卡片一致） */}
      <section className="about-card">
        <div className="panel-head">
          <h1>📰 关于 · 技术周报归档</h1>
        </div>
        <p className="hero-sub">多源技术情报 · AI 辅助汇总 · 每周归档发布</p>
        <div className="site-intro">
          <p>
            本站持续追踪 <strong>arXiv、Semantic Scholar、OpenAlex、技术 RSS 与 GitHub 趋势</strong>
            等多个公开信息源，由程序定时抓取、AI 辅助生成中文摘要与板块导读后归档发布，支持关键词检索、日历浏览、收藏与 RSS 订阅。
          </p>
          <p>
            本站为个人独立运营的非商业开源项目，与所收录内容的原始发布方不存在隶属或授权关系；所有条目均附原文链接，请以原文为准。
          </p>
        </div>
        <div className="hero-badges">
          <span className="hero-badge">🤖 AI 辅助汇总</span>
          <span className="hero-badge">🗂️ 多源聚合</span>
          <span className="hero-badge">📅 每周定时更新</span>
          <a className="hero-badge" href={feedUrl} target="_blank" rel="noopener">
            📡 RSS 订阅
          </a>
          <a className="hero-badge" href={REPO_URL} target="_blank" rel="noopener">
            💻 源码仓库
          </a>
        </div>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-k">运营方式</span>
            <span className="info-v">个人独立运营 · 非商业项目</span>
          </div>
          <div className="info-item">
            <span className="info-k">更新频率</span>
            <span className="info-v">每周定时更新</span>
          </div>
          <div className="info-item">
            <span className="info-k">订阅渠道</span>
            <span className="info-v">
              <a href={feedUrl} target="_blank" rel="noopener">
                RSS 订阅
              </a>
            </span>
          </div>
          <div className="info-item">
            <span className="info-k">部署平台</span>
            <span className="info-v">GitHub Pages</span>
          </div>
        </div>
      </section>

      {/* 模块三：免责声明 */}
      <section className="about-card">
        <div className="panel-head">
          <h2>📜 免责声明</h2>
        </div>
        <ol className="disclaimer-list">
          <li>
            本站条目均由程序自动抓取公开信息，并经 <strong>AI 辅助生成摘要</strong>
            ，仅供信息参考，不构成任何投资、投稿或使用建议。
          </li>
          <li>
            摘要、标签与评分可能存在偏差，具体内容请<strong>以条目附带的原文链接为准</strong>。
          </li>
          <li>
            本站仅收录公开信息，只呈现标题、原文链接与自产摘要，<strong>不转载原文</strong>。
          </li>
          <li>
            内容如涉侵权或不实，请通过
            <a href="https://yjmm10.github.io/" target="_blank" rel="noopener">
              个人主页
            </a>
            中的微信与我们联系，核实后将及时处理。
          </li>
        </ol>
      </section>
    </div>
  );
}
