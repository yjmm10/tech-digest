import { useEffect, useRef } from "react";
import ThemeToggle from "./ThemeToggle";
import ViewTabs, { type SiteNavView } from "./ViewTabs";

/**
 * 站点顶栏（全站唯一实例，由 App 顶层常驻渲染）：
 * - 只承担「品牌身份 + 视图导航 + 实用操作」三职；站内统计数据一律不放这里
 *   （落地页 hero 数据行 / 数据站侧栏统计 / 结果头部计数才是数据的家）
 * - 四个视图共用同一份 DOM 节点，切换标签只更新 ViewTabs 高亮类，
 *   顶栏永不卸载重建 → 布局零跳动、零闪烁
 * - 内容容器复刻 .page 宽度体系（max-width 1080px + 同款左右内边距），
 *   保证任意视口宽度下品牌/操作区与内容区像素对位
 * - 内部测量自身高度写入 --hero-h，供筛选栏/侧栏 sticky 定位使用
 */
export default function SiteHeader({
  active,
  onNavigate,
}: {
  active: SiteNavView;
  onNavigate: (view: SiteNavView) => void;
}) {
  const heroRef = useRef<HTMLElement | null>(null);

  /* 固定抬头：测量自身高度写入 --hero-h，供筛选栏/侧栏 sticky 定位 */
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const setH = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty("--hero-h", `${h}px`);
    };
    setH();
    const ro = new ResizeObserver(setH);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header ref={heroRef} className="site-nav">
      <div className="site-nav__inner">
        <div className="hero__row">
          <a
            className="hero__brand"
            href="#/"
            title="返回首页"
            onClick={(e) => {
              /* 已在首页：拦截锚点默认行为，走同页平滑回顶（否则视觉上无反应）。
                 非首页：保留原生锚点行为，由 hashchange → 路由切换，浏览器历史正确 */
              if (active === "landing") {
                e.preventDefault();
                onNavigate("landing");
              }
            }}
          >
            <img
              className="hero__logo"
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt=""
              width={40}
              height={40}
            />
            <span className="hero__title">技术周报归档</span>
          </a>
          <div className="hero__actions">
            <a
              className="rss-link"
              href={`${import.meta.env.BASE_URL}feed.xml`}
              type="application/rss+xml"
              title="订阅每周 Markdown 周报（RSS）"
            >
              RSS
            </a>
            <ThemeToggle />
            <ViewTabs active={active} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </header>
  );
}
