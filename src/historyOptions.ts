/** Past-history chips. Stored values are these Korean labels; never rename one without a migration. */
export type HistoryGroup = { id: string; title: string; items: string[] };
export const HISTORY_GROUPS: HistoryGroup[] = [
  { id: "common", title: "자주 선택", items: ["고혈압", "당뇨", "고지혈증"] },
  { id: "cardio", title: "심혈관", items: ["협심증", "심근경색", "부정맥", "심부전", "항응고제"] },
  { id: "neuro", title: "뇌·신경", items: ["뇌경색", "뇌출혈", "뇌전증", "파킨슨병"] },
  { id: "respiratory", title: "호흡기·감염", items: ["천식", "COPD", "결핵"] },
  { id: "renal", title: "신장·간", items: ["신부전", "투석 월·수·금", "투석 화·목·토", "간경화", "간염"] },
  { id: "psychiatric", title: "정신", items: ["우울증", "양극성장애", "조현병"] },
  { id: "other", title: "기타", items: ["암", "갑상선질환", "치매", "수술", "임신", "알러지"] },
];
export const HISTORY_OPTIONS = HISTORY_GROUPS.flatMap((group) => group.items);
export const DIALYSIS_OPTIONS = ["투석 월·수·금", "투석 화·목·토"];

/** Dialysis implies renal failure; only one dialysis schedule can be chosen. */
export function toggleHistoryItem(history: string[], item: string): string[] {
  let next = [...history];
  if (next.includes(item)) {
    next = next.filter((entry) => entry !== item);
    if (item === "신부전") next = next.filter((entry) => !DIALYSIS_OPTIONS.includes(entry));
    return next;
  }
  if (DIALYSIS_OPTIONS.includes(item)) {
    next = next.filter((entry) => !DIALYSIS_OPTIONS.includes(entry));
    if (!next.includes("신부전")) next.push("신부전");
  }
  next.push(item);
  return next;
}

/** Selected items in list order; unknown saved values keep their place at the end. */
export function orderedHistory(history: string[]): string[] {
  const known = HISTORY_OPTIONS.filter((item) => history.includes(item));
  return [...known, ...history.filter((item) => !HISTORY_OPTIONS.includes(item))];
}

export function historySummary(history: string[], label: (item: string) => string = (item) => item, prefix = "과거력"): string {
  const dialysis = history.find((item) => DIALYSIS_OPTIONS.includes(item));
  const entries = orderedHistory(history)
    .filter((item) => !DIALYSIS_OPTIONS.includes(item))
    .map((item) => (item === "신부전" && dialysis ? `${label(item)}(${label(dialysis)})` : label(item)));
  return entries.length > 0 ? `${prefix}: ${entries.join(", ")}` : "";
}
