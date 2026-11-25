import type { EntryLayout } from "./ResultsHeader";

export function entryListClass(layout: EntryLayout): string {
  if (layout === "grid") return "card-list card-list--grid";
  if (layout === "waterfall") return "card-list card-list--waterfall";
  return "card-list card-list--list";
}
