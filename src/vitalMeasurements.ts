export const vitalKeys = ["bp", "pr", "rr", "spo2", "bt", "bst"] as const;
export type VitalKey = (typeof vitalKeys)[number];
export type VitalValues = Record<(typeof vitalKeys)[number], string> & {
  measuredDate: string;
  measuredTime: string;
  measuredAt: string;
};
export type VitalMeasurement = VitalValues & { id: string };
export type MeasurementForm = VitalValues & {
  vitalMeasurements: VitalMeasurement[];
  activeMeasurementId: string;
};
export function blankMeasurement(id: string): VitalMeasurement {
  return {
    id,
    bp: "",
    pr: "",
    rr: "",
    spo2: "",
    bt: "",
    bst: "",
    measuredDate: "",
    measuredTime: "",
    measuredAt: "",
  };
}
export function normalizeMeasurements(
  value: unknown,
  activeId: unknown,
): Pick<MeasurementForm, "vitalMeasurements" | "activeMeasurementId"> {
  const records: VitalMeasurement[] = [];
  const seen = new Set<string>();
  if (Array.isArray(value))
    value.forEach((record: unknown, index: number) => {
      if (!record || typeof record !== "object") return;
      const source = record as Record<string, unknown>;
      let id =
        typeof source.id === "string" && source.id
          ? source.id
          : `restored-${index}`;
      while (seen.has(id)) id += "-copy";
      seen.add(id);
      const clean = blankMeasurement(id);
      for (const key of [
        ...vitalKeys,
        "measuredDate",
        "measuredTime",
        "measuredAt",
      ] as const)
        if (typeof source[key] === "string") clean[key] = source[key];
      records.push(clean);
    });
  if (!records.length) records.push(blankMeasurement("first"));
  return {
    vitalMeasurements: records,
    activeMeasurementId:
      typeof activeId === "string" &&
      records.some((record) => record.id === activeId)
        ? activeId
        : records[0]!.id,
  };
}
// Active fields remain compatible with older saved records and existing exports.
export function snapshotMeasurements(
  form: MeasurementForm,
): VitalMeasurement[] {
  const active = blankMeasurement(form.activeMeasurementId || "first");
  for (const key of [
    ...vitalKeys,
    "measuredDate",
    "measuredTime",
    "measuredAt",
  ] as const)
    active[key] = form[key];
  const records = form.vitalMeasurements.length
    ? form.vitalMeasurements
    : [active];
  return records.map((record) => (record.id === active.id ? active : record));
}
export function selectMeasurement<T extends MeasurementForm>(
  form: T,
  id: string,
): T {
  const records = snapshotMeasurements(form),
    target = records.find((record) => record.id === id);
  if (!target) return form;
  const { id: activeMeasurementId, ...values } = target;
  return {
    ...form,
    ...values,
    vitalMeasurements: records,
    activeMeasurementId,
  };
}
export function addMeasurement<T extends MeasurementForm>(
  form: T,
  id: string,
): T {
  return selectMeasurement(
    {
      ...form,
      vitalMeasurements: [...snapshotMeasurements(form), blankMeasurement(id)],
    },
    id,
  );
}
export function deleteMeasurement<T extends MeasurementForm>(form: T): T {
  const records = snapshotMeasurements(form),
    index = records.findIndex(
      (record) => record.id === form.activeMeasurementId,
    );
  const remaining = records.filter(
    (record) => record.id !== form.activeMeasurementId,
  );
  const target =
    remaining[Math.min(Math.max(index, 0), remaining.length - 1)] ??
    blankMeasurement("first");
  const { id: activeMeasurementId, ...values } = target;
  return {
    ...form,
    ...values,
    vitalMeasurements: remaining.length ? remaining : [target],
    activeMeasurementId,
  };
}
