import { useMemo } from "react";
import { DayPicker } from "react-day-picker";
import type {
  DayButtonProps,
  MonthCaptionProps,
} from "react-day-picker";
import { zhCN } from "date-fns/locale";
import type { DigestEntry, DigestUpdate } from "./types";
import type { DateFilterMode } from "./filterUtils";
import { effectivePublishedDay } from "./filterUtils";
import { formatDay, monthTitle, parseDay } from "./dateUtils";
import "./DigestCalendar.css";

export interface DayActivity {
  entryCount: number;
  crawlCount: number;
}

export interface DigestCalendarProps {
  updates: DigestUpdate[];
  entries: DigestEntry[];
  selectedDay: string | null;
  viewYear: number;
  viewMonth: number;
  onSelectDay: (day: string | null) => void;
  onViewMonthChange: (year: number, month: number) => void;
}

const CALENDAR_DATE_MODE: DateFilterMode = "published";

/** 与筛选逻辑一致：含 GitHub 周榜→周日 */
export function buildDayActivityMap(
  updates: DigestUpdate[],
  entries: DigestEntry[],
  mode: DateFilterMode,
): Map<string, DayActivity> {
  const map = new Map<string, DayActivity>();

  const bump = (day: string, field: keyof DayActivity, n = 1) => {
    const cur = map.get(day) ?? { entryCount: 0, crawlCount: 0 };
    cur[field] += n;
    map.set(day, cur);
  };

  for (const u of updates) {
    const crawlDay = u.crawlDate || u.updatedAt.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(crawlDay)) bump(crawlDay, "crawlCount");
  }

  if (mode === "crawl") {
    for (const u of updates) {
      const crawlDay = u.crawlDate || u.updatedAt.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(crawlDay)) {
        bump(crawlDay, "entryCount", u.entryCount);
      }
    }
    return map;
  }

  for (const e of entries) {
    if (mode === "published") {
      const pub = effectivePublishedDay(e);
      if (pub) bump(pub, "entryCount");
      continue;
    }
    if (e.dateStart && e.dateEnd) {
      const start = parseDay(e.dateStart);
      const end = parseDay(e.dateEnd);
      const cur = new Date(start);
      while (cur <= end) {
        bump(formatDay(cur), "entryCount");
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  return map;
}

export function countEntriesOnDay(
  entries: DigestEntry[],
  day: string,
  mode: DateFilterMode,
): number {
  if (mode !== "published") return 0;
  return buildDayActivityMap([], entries, mode).get(day)?.entryCount ?? 0;
}

function heatLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 10) return 2;
  return 3;
}

export default function DigestCalendar({
  updates,
  entries,
  selectedDay,
  viewYear,
  viewMonth,
  onSelectDay,
  onViewMonthChange,
}: DigestCalendarProps) {
  const activity = useMemo(
    () => buildDayActivityMap(updates, entries, CALENDAR_DATE_MODE),
    [updates, entries],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const [day, act] of activity) {
      if (act.entryCount > 0) m.set(day, act.entryCount);
    }
    return m;
  }, [activity]);

  const crawlDays = useMemo(() => {
    const s = new Set<string>();
    for (const [day, act] of activity) {
      if (act.crawlCount > 0) s.add(day);
    }
    return s;
  }, [activity]);

  const monthMax = useMemo(() => {
    let max = 0;
    const prefix = `${viewYear}-${String(viewMonth).padStart(2, "0")}-`;
    for (const [day, n] of counts) {
      if (day.startsWith(prefix) && n > max) max = n;
    }
    return max;
  }, [counts, viewYear, viewMonth]);

  const selectedCount = selectedDay
    ? (counts.get(selectedDay) ?? 0)
    : 0;

  const selectedDate = useMemo(
    () => (selectedDay ? parseDay(selectedDay) : undefined),
    [selectedDay],
  );
  const viewMonthDate = useMemo(() => new Date(viewYear, viewMonth - 1, 1), [viewYear, viewMonth]);

  const handleMonthChange = (d: Date) => {
    onViewMonthChange(d.getFullYear(), d.getMonth() + 1);
  };

  const handleSelect = (d: Date | undefined) => {
    onSelectDay(d ? formatDay(d) : null);
  };

  /* 日期按钮：单行数字，热度由格子底色表达，计数走 tooltip（闭包共享预计算数据） */
  const CalDayButton = ({ day, modifiers, ...btnProps }: DayButtonProps) => {
    const dayStr = formatDay(day.date);
    const count = counts.get(dayStr) ?? 0;
    const tier = heatLevel(count);
    const hasCrawl = crawlDays.has(dayStr);
    const isSelected = Boolean(modifiers.selected);
    const isToday = Boolean(modifiers.today);
    const title = count > 0
      ? `${dayStr}：${count} 条${hasCrawl ? " · 有抓取" : ""}`
      : hasCrawl
        ? `${dayStr}：抓取日`
        : dayStr;

    return (
      <button
        {...btnProps}
        className={[
          btnProps.className,
          "cal-day-btn",
          tier > 0 ? `cal-day-btn--heat-${tier}` : "",
          hasCrawl ? "cal-day-btn--crawl" : "",
          isSelected ? "cal-day-btn--selected" : "",
          isToday && !isSelected ? "cal-day-btn--today" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        title={title}
      >
        <span className="cal-day-btn__num">{day.date.getDate()}</span>
        {hasCrawl && <span className="cal-day-btn__dot" aria-hidden />}
      </button>
    );
  };

  /* 月份标题：保持「YYYY 年 M 月」中文格式 */
  const CalCaption = ({ calendarMonth }: MonthCaptionProps) => (
    <span className="cal-caption">
      {monthTitle(calendarMonth.date.getFullYear(), calendarMonth.date.getMonth() + 1)}
    </span>
  );

  return (
    <section className="calendar" aria-label="日历浏览">
      <div className="calendar__head">
        <div>
          <h2 className="calendar__title">日历</h2>
          <p className="calendar__hint">按发表日 · 周榜归周日</p>
        </div>
        <div className="calendar__actions">
          <button
            type="button"
            className="calendar__today"
            onClick={() => {
              const now = new Date();
              onViewMonthChange(now.getFullYear(), now.getMonth() + 1);
              onSelectDay(formatDay(now));
            }}
          >
            今天
          </button>
          {selectedDay && (
            <button
              type="button"
              className="calendar__clear-btn"
              onClick={() => onSelectDay(null)}
            >
              清除
            </button>
          )}
        </div>
      </div>

      <DayPicker
        mode="single"
        locale={zhCN}
        weekStartsOn={0}
        showOutsideDays={false}
        month={viewMonthDate}
        onMonthChange={handleMonthChange}
        selected={selectedDate}
        onSelect={handleSelect}
        modifiers={{
          data: (day: Date) => counts.has(formatDay(day)),
          crawl: (day: Date) => crawlDays.has(formatDay(day)),
        }}
        modifiersClassNames={{
          data: "cal-mod-data",
          crawl: "cal-mod-crawl",
        }}
        components={{
          DayButton: CalDayButton,
          MonthCaption: CalCaption,
        }}
      />

      <ul className="calendar__legend">
        <li className="calendar__legend-scale" aria-label="热度刻度">
          <span className="calendar__swatch calendar__swatch--t1" />
          <span className="calendar__swatch calendar__swatch--t2" />
          <span className="calendar__swatch calendar__swatch--t3" />
          <span className="calendar__legend-scale-label">少 → 多</span>
        </li>
        <li>
          <span className="calendar__swatch calendar__swatch--crawl" /> 抓取日
        </li>
        {monthMax > 0 && (
          <li className="calendar__legend-max">本月峰值 {monthMax}</li>
        )}
      </ul>

      {selectedDay && (
        <p className="calendar__selection">
          <strong>{selectedDay}</strong>
          {selectedCount > 0 ? ` · ${selectedCount} 条` : " · 该日无条目"}
          <span className="calendar__selection-note">（右侧列表已按日筛选）</span>
        </p>
      )}
    </section>
  );
}
