import type { PageView } from "./routeHash";

/** 站点级导航目标（landing 之外的三个视图） */
export type SiteNavView = Exclude<PageView, "landing">;

const NAV_ITEMS: { key: SiteNavView; label: string }[] = [
  { key: "entries", label: "条目浏览" },
  { key: "markdown", label: "Markdown 原文" },
  { key: "about", label: "关于" },
];

/* 站点导航小图标（随 currentColor 变色） */
function TabIcon({ kind }: { kind: SiteNavView }) {
  const p = {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "entries") return <svg {...p}><path d="M2.5 4h11M2.5 8h11M2.5 12h7" /></svg>;
  if (kind === "markdown")
    return (
      <svg {...p}>
        <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
        <path d="M5.5 6h5M5.5 9h5M5.5 12h3" />
      </svg>
    );
  return (
    <svg {...p}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 7.5v3" />
      <path d="M8 5.2v.1" />
    </svg>
  );
}

export interface ViewTabsProps {
  /** 当前激活的视图；落地页等无对应视图时传 null（三项均不高亮） */
  active: SiteNavView | null;
  onNavigate: (view: SiteNavView) => void;
  className?: string;
}

/**
 * 站点导航胶囊分段控件：条目浏览 / Markdown 原文 / 关于。
 * 数据站顶栏与落地页顶栏共用，保证跨页面导航语言一致。
 */
export default function ViewTabs({ active, onNavigate, className = "" }: ViewTabsProps) {
  return (
    <nav className={`view-tabs ${className}`.trim()} aria-label="站点导航">
      {NAV_ITEMS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`view-tabs__btn ${active === key ? "view-tabs__btn--active" : ""}`}
          onClick={() => onNavigate(key)}
          aria-current={active === key ? "page" : undefined}
        >
          <TabIcon kind={key} />
          {label}
        </button>
      ))}
    </nav>
  );
}
