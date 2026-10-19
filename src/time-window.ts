import type { Period } from "./domain.ts";
export type TimeWindow = Period | "All";
export type WindowScope = "everything" | "this" | "last" | "next";
export type WindowUnit = "day" | "week" | "month";
export function windowParts(value: TimeWindow): {
  scope: WindowScope;
  unit: WindowUnit | null;
} {
  if (value === "All") return { scope: "everything", unit: null };
  return {
    scope:
      value === "Yesterday" || value.startsWith("Last")
        ? "last"
        : value === "Tomorrow" || value.startsWith("Next")
          ? "next"
          : "this",
    unit: value.includes("Week")
      ? "week"
      : value.includes("Month")
        ? "month"
        : "day",
  };
}
export function windowValue(
  scope: WindowScope,
  unit: WindowUnit = "week",
): TimeWindow {
  if (scope === "everything") return "All";
  if (unit === "day")
    return { this: "Today", last: "Yesterday", next: "Tomorrow" }[
      scope
    ] as Period;
  return `${{ this: "This", last: "Last", next: "Next" }[scope]} ${unit === "week" ? "Week" : "Month"}` as Period;
}
export function changeWindowScope(
  value: TimeWindow,
  scope: WindowScope,
): TimeWindow {
  const { unit } = windowParts(value);
  return windowValue(scope, unit === "month" ? "month" : "week");
}
