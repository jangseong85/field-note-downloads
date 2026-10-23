import { koreanNowParts, validTime, weekdayForDate } from "./dateTime";

export type WheelDraft = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};
export const monthDays = (year: number, month: number) =>
  new Date(year, month, 0, 12).getDate();
export function wheelDraft(
  date: string,
  time: string,
  now = koreanNowParts(),
): WheelDraft {
  const d = weekdayForDate(date) ? date.replace(/\D/g, "") : now.date;
  const t = validTime(time) ? time : now.time;
  return {
    year: +d.slice(0, 4),
    month: +d.slice(4, 6),
    day: +d.slice(6, 8),
    hour: +t.slice(0, 2),
    minute: +t.slice(2, 4),
  };
}
export function changeWheel(
  draft: WheelDraft,
  part: keyof WheelDraft,
  value: number,
): WheelDraft {
  const next = { ...draft, [part]: value };
  next.year = Math.max(1900, Math.min(2100, next.year));
  next.month = Math.max(1, Math.min(12, next.month));
  next.day = Math.max(1, Math.min(monthDays(next.year, next.month), next.day));
  next.hour = Math.max(0, Math.min(23, next.hour));
  next.minute = Math.max(0, Math.min(59, next.minute));
  return next;
}
export function wheelParts(draft: WheelDraft) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${draft.year}${pad(draft.month)}${pad(draft.day)}`,
    time: `${pad(draft.hour)}${pad(draft.minute)}`,
  };
}
