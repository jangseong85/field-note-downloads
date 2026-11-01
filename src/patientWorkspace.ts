import type { MemoAttachment } from "./MemoAttachments";
import { blankMeasurement, normalizeMeasurements, type VitalMeasurement } from "./vitalMeasurements";
import { parseTimestamp } from "./dateTime";

export type IdDocument = {
  uri: string;
  name: string | null;
  birthDate: string | null;
  capturedAt: string;
};
export type FormState = {
  attachments: MemoAttachment[];
  vitalMeasurements: VitalMeasurement[];
  activeMeasurementId: string;
  patientId: string;
  chiefComplaint: string;
  onsetDate: string;
  onsetTime: string;
  measuredAt: string;
  measuredDate: string;
  measuredTime: string;
  bp: string;
  pr: string;
  rr: string;
  spo2: string;
  bt: string;
  bst: string;
  historyMemo: string;
  name: string;
  birthDate: string;
  gender: string;
  patientPhone: string;
  guardianPhone: string;
  guardianName: string;
  guardianRelation: string;
  history: string[];
  idDocument: IdDocument | null;
  chiefComplaintDrawing: string | null;
  historyDrawing: string | null;
};
export type LegacyFormState = Partial<FormState> & {
  complaintTags?: string[];
  vitalRecords?: unknown;
  dialysisStatus?: string;
  cancerHistory?: string;
  mentalHistory?: string;
  memo?: string;
};

export const STORAGE_KEY = "ems-log.current-patient.v1";
/** `createdAt` (epoch ms) is missing on records saved before automatic expiry existed. */
export type PatientRecord = { id: string; form: FormState; createdAt?: number };
export type PatientWorkspace = { version: 2; activeId: string; patients: PatientRecord[] };
export const EMPTY: FormState = {
  attachments: [],
  vitalMeasurements: [blankMeasurement("first")],
  activeMeasurementId: "first",
  patientId: "",
  chiefComplaint: "",
  onsetDate: "",
  onsetTime: "",
  measuredAt: "",
  measuredDate: "",
  measuredTime: "",
  bp: "",
  pr: "",
  rr: "",
  spo2: "",
  bt: "",
  bst: "",
  historyMemo: "",
  name: "",
  birthDate: "",
  gender: "",
  patientPhone: "",
  guardianPhone: "",
  guardianName: "",
  guardianRelation: "",
  history: [],
  idDocument: null,
  chiefComplaintDrawing: null,
  historyDrawing: null,
};

export function migrateStoredForm(stored: LegacyFormState): FormState {
  const storedWithoutVitalRecords = { ...stored };
  delete storedWithoutVitalRecords.vitalRecords;
  const patientId =
    stored.patientId ||
    [
      stored.name && `성함: ${stored.name}`,
      stored.birthDate && `생년월일: ${stored.birthDate}`,
      stored.gender && `성별: ${stored.gender}`,
    ]
      .filter(Boolean)
      .join(" · ");
  const chiefComplaint = [
    (stored.complaintTags ?? []).join(", "),
    stored.chiefComplaint,
  ]
    .filter(Boolean)
    .join("\n");
  const historyLines = [
    (stored.history ?? []).length > 0 &&
      `과거력: ${(stored.history ?? []).join(", ")}`,
    stored.dialysisStatus &&
      stored.dialysisStatus !== "해당 없음" &&
      `투석: ${stored.dialysisStatus}`,
    stored.cancerHistory && `암: ${stored.cancerHistory}`,
    stored.mentalHistory && `정신질환: ${stored.mentalHistory}`,
    stored.memo,
  ].filter(Boolean);
  return {
    ...EMPTY,
    ...storedWithoutVitalRecords,
    attachments: Array.isArray(stored.attachments) ? stored.attachments.filter(item => item && typeof item.id === "string" && typeof item.uri === "string" && (item.kind === "photo" || item.kind === "audio")) : [],
    ...normalizeMeasurements(stored.vitalMeasurements, stored.activeMeasurementId),
    measuredDate: stored.measuredDate ?? parseTimestamp(stored.measuredAt ?? "").date,
    measuredTime: stored.measuredTime ?? parseTimestamp(stored.measuredAt ?? "").time,
    patientId,
    chiefComplaint,
    historyMemo: typeof stored.historyMemo === "string" ? stored.historyMemo : historyLines.join("\n"),
    history: stored.history ?? [],
    idDocument: stored.idDocument ?? null,
  };
}

export function emptyWorkspace(): PatientWorkspace {
  return { version: 2, activeId: "initial", patients: [{ id: "initial", form: migrateStoredForm({}) }] };
}

/** Reject an unreadable workspace instead of falling back to writable empty data. */
export function restoreWorkspace(saved: string | null): PatientWorkspace {
  if (saved === null) return emptyWorkspace();
  const stored = JSON.parse(saved) as PatientWorkspace & LegacyFormState;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) throw new Error("Invalid saved patient");
  if ("version" in stored && stored.version !== 2) throw new Error("Unsupported workspace version");
  if (stored.version === 2) {
    if (!Array.isArray(stored.patients) || !stored.patients.length) throw new Error("No saved patient");
    const ids = new Set<string>();
    const patients = stored.patients.map(patient => {
      if (!patient || typeof patient.id !== "string" || !patient.id || ids.has(patient.id) || !patient.form || typeof patient.form !== "object") throw new Error("Invalid saved patient");
      ids.add(patient.id);
      const createdAt = (patient as { createdAt?: unknown }).createdAt;
      return { id: patient.id, form: migrateStoredForm(patient.form), ...(typeof createdAt === "number" && Number.isFinite(createdAt) ? { createdAt } : {}) };
    });
    return { version: 2, activeId: patients.some(patient => patient.id === stored.activeId) ? stored.activeId : patients[0]!.id, patients };
  }
  return { version: 2, activeId: "initial", patients: [{ id: "initial", form: migrateStoredForm(stored) }] };
}

export function patientFileUris(workspace: PatientWorkspace): string[] {
  return workspace.patients.flatMap(({ form }) => [form.idDocument?.uri, form.chiefComplaintDrawing, form.historyDrawing, ...form.attachments.map(item => item.uri)]).filter((uri): uri is string => !!uri);
}

/** Patient records, with their photos, recordings and drawings, are deleted 24 hours after creation. */
export const PATIENT_RETENTION_MS = 24 * 60 * 60 * 1000;

export function isBlankForm(form: FormState): boolean {
  return JSON.stringify(form) === JSON.stringify(migrateStoredForm({}));
}

/**
 * Stamp unstamped (pre-expiry) records with `now` so they get a full 24 hours from the update,
 * and drop records older than the retention period. An empty workspace gets one blank patient.
 */
export function planPatientExpiry(workspace: PatientWorkspace, now: number, blankId: string, maxAge = PATIENT_RETENTION_MS) {
  const stamped = workspace.patients.map(patient =>
    typeof patient.createdAt === "number" && patient.createdAt <= now ? patient : { ...patient, createdAt: now });
  const removed = stamped.filter(patient => now - patient.createdAt! >= maxAge);
  const kept = stamped.filter(patient => now - patient.createdAt! < maxAge);
  const patients = kept.length ? kept : [{ id: blankId, form: migrateStoredForm({}), createdAt: now }];
  const activeId = patients.some(patient => patient.id === workspace.activeId) ? workspace.activeId : patients[patients.length - 1]!.id;
  const changed = removed.length > 0 || stamped.some((patient, index) => patient !== workspace.patients[index]);
  return { changed, removed, next: { version: 2 as const, activeId, patients } };
}
