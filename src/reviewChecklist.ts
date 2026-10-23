import { DIALYSIS_OPTIONS } from "./historyOptions";

/**
 * 현장 처치·이송·대원 안전 판단에 바로 쓰이는 확인 항목만 둔다. 앱은 판독이나 처치 권고를 하지 않는다.
 * 답은 병력 메모에 "항목: 답" 한 줄로 들어가고, 확인 여부는 그 줄이 있는지로만 판단한다.
 */
export type ReviewKind = "text" | "time" | "date";
export type ReviewItem = { id: string; ko: string; en: string; kind: ReviewKind; critical?: boolean };
const item = (id: string, ko: string, en: string, kind: ReviewKind = "text", critical = false): ReviewItem => ({
  id,
  ko,
  en,
  kind,
  critical,
});
export const COMMON_REVIEW: ReviewItem[] = [
  item("medication", "복용약(약봉투)", "Medication"),
  item("hospital", "다니는 병원", "F/U hospital"),
];
const oxygen = item("homeO2", "재택 산소", "Home O2");
const psychSafety = item("sceneSafety", "대원 안전", "Scene safety", "text", true);
const dialysis = [
  item("lastDialysis", "마지막 투석일", "Last HD", "date"),
  item("avfSide", "션트 팔", "AVF side", "text", true),
];
export const HISTORY_REVIEW: Record<string, ReviewItem[]> = {
  당뇨: [item("insulin", "인슐린 사용", "Insulin"), item("lastMeal", "마지막 식사", "Last meal", "time")],
  협심증: [item("ntg", "니트로 사용", "NTG use")],
  부정맥: [item("pacemaker", "박동기·제세동기 삽입", "PM / ICD")],
  심부전: [oxygen],
  항응고제: [item("fall", "낙상·머리 부딪힘", "Fall / head trauma", "text", true)],
  뇌경색: [item("baselineDeficit", "평소 마비·언어", "Baseline deficit")],
  뇌출혈: [item("baselineDeficit", "평소 마비·언어", "Baseline deficit")],
  뇌전증: [item("usualSeizure", "평소 발작과 같은지", "Usual seizure pattern")],
  천식: [item("inhaler", "흡입기 사용", "Inhaler")],
  COPD: [oxygen],
  결핵: [item("ppeMask", "대원 보호(마스크)", "PPE (mask)", "text", true)],
  ...Object.fromEntries(DIALYSIS_OPTIONS.map((option) => [option, dialysis])),
  간경화: [item("giBleeding", "토혈·흑색변", "Hematemesis / melena", "text", true)],
  간염: [item("ppeBlood", "대원 보호(혈액)", "PPE (blood)", "text", true)],
  우울증: [item("selfHarm", "자해·과다복용", "Self-harm / OD", "text", true)],
  양극성장애: [psychSafety],
  조현병: [psychSafety],
  암: [item("polst", "연명의료계획서(의료지도 요청)", "POLST (medical direction)")],
  치매: [item("baselineMentation", "평소 인지 수준", "Baseline mentation")],
  수술: [item("recentOp", "최근 수술", "Recent op")],
  임신: [item("gestation", "임신 주수", "GA"), item("vaginalBleeding", "질 출혈", "Vaginal bleeding", "text", true)],
  알러지: [item("allergen", "알러지 원인", "Allergen")],
};

export type ReviewGroup = { title: string; items: ReviewItem[] };
/** Common checks first, then each selected history in order; an item appears once. */
export function reviewGroups(history: string[]): ReviewGroup[] {
  if (!history.length) return [];
  const seen = new Set<string>();
  const take = (items: ReviewItem[]) =>
    items.filter((entry) => (seen.has(entry.id) ? false : (seen.add(entry.id), true)));
  const groups: ReviewGroup[] = [{ title: "공통", items: take(COMMON_REVIEW) }];
  for (const name of history) {
    const items = take(HISTORY_REVIEW[name] ?? []);
    if (items.length) groups.push({ title: name, items });
  }
  return groups;
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const linePattern = (entry: ReviewItem) =>
  new RegExp(`^(?:${escape(entry.ko)}|${escape(entry.en)}):[ \\t]?(.*)$`, "m");

/** The answer written for this item in the memo, or null when it has not been checked. */
export function reviewAnswer(memo: string, entry: ReviewItem): string | null {
  const match = memo.match(linePattern(entry));
  return match ? match[1]!.trim() : null;
}

/** Writes "label: answer" into the memo, replacing this item's earlier line if there is one. */
export function upsertReviewAnswer(memo: string, entry: ReviewItem, answer: string, medical: boolean): string {
  const line = `${medical ? entry.en : entry.ko}: ${answer.trim() || (medical ? "checked" : "확인")}`;
  if (linePattern(entry).test(memo)) return memo.replace(linePattern(entry), line);
  return memo.trimEnd() ? `${memo.trimEnd()}\n${line}` : line;
}

/** Quick answers for time questions, in Korea time. */
export function timeAnswer(minutesAgo: number, now: Date, medical: boolean): string {
  const at = new Date(now.getTime() - minutesAgo * 60000);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const clock = `${parts.find((p) => p.type === "hour")?.value ?? "00"}:${parts.find((p) => p.type === "minute")?.value ?? "00"}`;
  if (minutesAgo === 0) return `${clock} (${medical ? "just now" : "방금"})`;
  const ago =
    minutesAgo >= 60
      ? medical
        ? `${minutesAgo / 60} h ago`
        : `약 ${minutesAgo / 60}시간 전`
      : medical
        ? `${minutesAgo} min ago`
        : `약 ${minutesAgo}분 전`;
  return `${clock} (${ago})`;
}
/** Quick answers for date questions, in Korea time. */
export function dateAnswer(daysAgo: number, now: Date, medical: boolean): string {
  const at = new Date(now.getTime() - daysAgo * 86400000);
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const date = `${parts.find((p) => p.type === "month")?.value}.${parts.find((p) => p.type === "day")?.value}`;
  const words = medical ? ["today", "yesterday", "2 days ago"] : ["오늘", "어제", "그제"];
  return `${date} (${words[daysAgo] ?? ""})`;
}
export const unknownAnswer = (medical: boolean) => (medical ? "unknown" : "모름");
