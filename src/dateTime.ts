export const dateDigits = (value: string) =>
  value.replace(/\D/g, "").slice(0, 8);
export const timeDigits = (value: string) =>
  value.replace(/\D/g, "").slice(0, 4);

export function formatDate(value: string): string {
  const digits = dateDigits(value);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}. ${digits.slice(4)}`;
  return `${digits.slice(0, 4)}. ${digits.slice(4, 6)}. ${digits.slice(6)}`;
}

export function formatTime(value: string): string {
  const digits = timeDigits(value);
  return digits.length <= 2
    ? digits
    : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function weekdayForDate(value: string): string | null {
  const digits = dateDigits(value);
  if (digits.length !== 8) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6));
  const parsed = new Date(year, month - 1, day, 12);
  if (
    year < 1900 ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  )
    return null;
  return (
    ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][
      parsed.getDay()
    ] ?? null
  );
}

export function validTime(value: string): boolean {
  return (
    /^\d{4}$/.test(value) &&
    Number(value.slice(0, 2)) < 24 &&
    Number(value.slice(2)) < 60
  );
}

/** Clinical timestamps are entered in Korea time, regardless of device timezone. */
export function relativeOnset(
  date: string,
  time: string,
  now = Date.now(),
): string | null {
  if (
    !/^\d{8}$/.test(date) ||
    !weekdayForDate(date) ||
    !validTime(time) ||
    !Number.isFinite(now)
  )
    return null;
  const timestamp = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(4, 6)) - 1,
    Number(date.slice(6)),
    Number(time.slice(0, 2)) - 9,
    Number(time.slice(2)),
  );
  const delta = now - timestamp;
  if (delta >= 0 && delta < 60000) return "방금 전";
  let minutes =
    delta >= 0 ? Math.floor(delta / 60000) : Math.ceil(-delta / 60000);
  const days = Math.floor(minutes / 1440);
  minutes %= 1440;
  const hours = Math.floor(minutes / 60);
  minutes %= 60;
  const parts = [
    days && `${days}일`,
    hours && `${hours}시간`,
    minutes && `${minutes}분`,
  ].filter(Boolean);
  return `${parts.join(" ")} ${delta >= 0 ? "전" : "후"}`;
}

export function parseTimestamp(value: string): { date: string; time: string } {
  const digits = value.replace(/\D/g, "");
  return { date: digits.slice(0, 8), time: digits.slice(8, 12) };
}

export function formatTimestamp(date: string, time: string): string {
  return weekdayForDate(date) && validTime(time)
    ? `${formatDate(date)}. ${formatTime(time)}`
    : "";
}

export function koreanNowParts(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}${get("month")}${get("day")}`,
    time: `${get("hour")}${get("minute")}`,
  };
}

/** "35분 전" → "35 min ago" for the medical-terms screen. */
export function relativeOnsetMedical(text: string): string {
  if (text === "방금 전") return "just now";
  return text
    .replace(/(\d+)일/g, "$1 d")
    .replace(/(\d+)시간/g, "$1 h")
    .replace(/(\d+)분/g, "$1 min")
    .replace(/ 전$/, " ago")
    .replace(/ 후$/, " later");
}
