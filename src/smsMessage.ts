import { dateDigits, formatTime, timeDigits } from "./dateTime";
import { VitalMeasurement, vitalKeys } from "./vitalMeasurements";

export type SmsSection = "affiliation" | "identity" | "complaint" | "vitals" | "history";
export const SMS_SECTIONS: SmsSection[] = ["affiliation", "identity", "complaint", "vitals", "history"];
export type SenderInfo = { affiliation: string; rank: string; name: string };
export type SmsSource = {
  sender: SenderInfo;
  name: string;
  birthDate: string;
  chiefComplaint: string;
  onsetDate: string;
  onsetTime: string;
  measurements: VitalMeasurement[];
  /** Already formatted, e.g. "과거력: 고혈압, 신부전(투석 월·수·금)". */
  historySummary: string;
  photoCount: number;
  /** Medical-terms screen mode: Pt / C/C / Photos instead of 환자 / 주증상 / 첨부. */
  medical?: boolean;
};
const VITAL_LABELS: Record<(typeof vitalKeys)[number], string> = {
  bp: "BP",
  pr: "PR",
  rr: "RR",
  spo2: "SpO2",
  bt: "BT",
  bst: "BST",
};

/** The most recent measurement round that has at least one value. */
export function latestMeasurement(measurements: VitalMeasurement[]): VitalMeasurement | null {
  for (let index = measurements.length - 1; index >= 0; index--) {
    const record = measurements[index]!;
    if (vitalKeys.some((key) => record[key].trim())) return record;
  }
  return null;
}

const dotDate = (digits: string) => `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

function onsetText(date: string, time: string, today: string): string {
  const day = dateDigits(date);
  const clock = timeDigits(time).length === 4 ? formatTime(time) : "";
  if (!clock && day.length !== 8) return "";
  if (day.length === 8 && day !== today)
    return `Onset ${day.slice(4, 6)}.${day.slice(6)}${clock ? ` ${clock}` : ""}`;
  return clock ? `Onset ${clock}` : "";
}

/** Each section's line, or null when nothing was entered (shown as 미기입 and not selectable). */
export function smsLines(source: SmsSource, today: string): Record<SmsSection, string | null> {
  const sender = [source.sender.affiliation, source.sender.rank, source.sender.name].map(oneLine).filter(Boolean);
  const birth = dateDigits(source.birthDate);
  const identity = [oneLine(source.name), birth.length === 8 ? dotDate(birth) : ""].filter(Boolean);
  const complaint = oneLine(source.chiefComplaint);
  const onset = onsetText(source.onsetDate, source.onsetTime, dateDigits(today));
  const record = latestMeasurement(source.measurements);
  let vitals: string | null = null;
  if (record) {
    const values = vitalKeys.map((key) => {
      const value = record[key].trim();
      if (!value) return `${VITAL_LABELS[key]} -`;
      return `${VITAL_LABELS[key]} ${value}${key === "spo2" ? "%" : ""}`;
    });
    const clock = timeDigits(record.measuredTime).length === 4 ? `(${formatTime(record.measuredTime)})` : "";
    vitals = `V/S${clock}: ${values.join(", ")}`;
  }
  return {
    affiliation: sender.length ? `[${sender.join(" ")}]` : null,
    identity: identity.length ? `${source.medical ? "Pt" : "환자"}: ${identity.join(" / ")}` : null,
    complaint:
      complaint || onset
        ? `${source.medical ? "C/C" : "주증상"}: ${[complaint, onset && (complaint ? `(${onset})` : onset)].filter(Boolean).join(" ")}`
        : null,
    vitals,
    history: source.historySummary.trim() || null,
  };
}

/** Builds the SMS body for the sections the paramedic ticked, in a fixed order. */
export function buildSmsMessage(source: SmsSource, sections: SmsSection[], today: string): string {
  const lines = smsLines(source, today);
  const body = SMS_SECTIONS.filter((section) => sections.includes(section))
    .map((section) => lines[section])
    .filter((line): line is string => !!line);
  if (source.photoCount > 0)
    body.push(source.medical ? `Photos: ${source.photoCount}` : `첨부: 사진 ${source.photoCount}장`);
  return body.join("\n");
}
