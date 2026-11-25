import type { SortKey } from "./sortEntries";
import { SORT_LABEL } from "./sortEntries";
import { formatChineseDate } from "./dateUtils";

export type EntryLayout = "list" | "grid" | "waterfall";

/* 展示方式小图标（随 currentColor 变色） */
function ViewIcon({ kind }: { kind: "list" | "grid" | "waterfall" | "group" }) {
  const p = {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "list") return <svg {...p}><path d="M2.5 4h11M2.5 8h11M2.5 12h7" /></svg>;
  if (kind === "grid")
    return (
      <svg {...p}>
        <rect x="2.5" y="2.5" width="4.6" height="4.6" rx="1" />
        <rect x="8.9" y="2.5" width="4.6" height="4.6" rx="1" />
        <rect x="2.5" y="8.9" width="4.6" height="4.6" rx="1" />
        <rect x="8.9" y="8.9" width="4.6" height="4.6" rx="1" />
      </svg>
    );
  if (kind === "waterfall") return <svg {...p}><path d="M4 3v7M8 3v10M12 3v5" /></svg>;
  return <svg {...p}><path d="M2.5 5.5h11M2.5 5.5v6a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-6M5.5 5.5v-1a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" /></svg>;
}

export interface ResultsHeaderProps {
  count: number;
  calendarDay: string | null;
  selectedDigestLabel: string;
  sortKey: SortKey;
  favOnly?: boolean;
  entryLayout: EntryLayout;
  onEntryLayoutChange: (v: EntryLayout) => void;
  groupView: boolean;
  onGroupViewChange: (v: boolean) => void;
}

export default function ResultsHeader({
  count,
  calendarDay,
  selectedDigestLabel,
  sortKey,
  favOnly,
  entryLayout,
  onEntryLayoutChange,
  groupView,
  onGroupViewChange,
}: ResultsHeaderProps) {
  let hint = `按${SORT_LABEL[sortKey]}排序`;
  if (favOnly) hint = `仅收藏 · ${hint}`;
  if (calendarDay) {
    hint = `${formatChineseDate(calendarDay)} · ${hint}`;
  } else if (selectedDigestLabel) {
    hint = `期次 ${selectedDigestLabel} · ${hint}`;
  }

  return (
    <div className="results-header">
      <div className="results-header__main">
        <h2 className="results-header__title">
          检索结果
          <span className="results-header__count">{count}</span>
        </h2>
        <p className="results-header__hint">{hint}</p>
      </div>
      <div className="results-header__views" role="group" aria-label="展示方式">
        <button
          type="button"
          className={`results-header__view-btn ${entryLayout === "list" ? "results-header__view-btn--on" : ""}`}
          onClick={() => onEntryLayoutChange("list")}
          aria-pressed={entryLayout === "list"}
          title="列表展示"
        >
          <ViewIcon kind="list" />
          列表
        </button>
        <button
          type="button"
          className={`results-header__view-btn ${entryLayout === "grid" ? "results-header__view-btn--on" : ""}`}
          onClick={() => onEntryLayoutChange("grid")}
          aria-pressed={entryLayout === "grid"}
          title="方块卡片"
        >
          <ViewIcon kind="grid" />
          方块
        </button>
        <button
          type="button"
          className={`results-header__view-btn ${entryLayout === "waterfall" ? "results-header__view-btn--on" : ""}`}
          onClick={() => onEntryLayoutChange("waterfall")}
          aria-pressed={entryLayout === "waterfall"}
          title="瀑布流卡片"
        >
          <ViewIcon kind="waterfall" />
          瀑布
        </button>
        <button
          type="button"
          className={`results-header__view-btn ${groupView ? "results-header__view-btn--on" : ""}`}
          onClick={() => onGroupViewChange(!groupView)}
          aria-pressed={groupView}
          title="按来源分组"
        >
          <ViewIcon kind="group" />
          分组
        </button>
      </div>
    </div>
  );
}
