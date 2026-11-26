import type { PageView } from "./routeHash";

/** 站点级导航目标：含落地页（首页）在内的全部视图 */
export type SiteNavView = PageView;

const NAV_ITEMS: { key: SiteNavView; label: string }[] = [
  { key: "landing", label: "首页" },
  { key: "entries", label: "条目浏览" },
  { key: "markdown", label: "Markdown 原文" },
  { key: "about", label: "关于" },
];

export interface ViewTabsProps {
  /** 当前激活的视图；无对应视图时传 null（四项均不高亮） */
  active: SiteNavView | null;
  onNavigate: (view: SiteNavView) => void;
  className?: string;
}

/**
 * 站点导航胶囊分段控件：首页 / 条目浏览 / Markdown 原文 / 关于。
 * 所有页面顶栏共用同一组标签，当前页高亮，保证切换时顶部布局恒定。
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
          {label}
        </button>
      ))}
    </nav>
  );
}
