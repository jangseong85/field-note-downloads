export type PatientWorkspaceLike<F> = {
  version: 2;
  activeId: string;
  patients: { id: string; form: F }[];
};

/** Plan an explicit all-patient reset without mutating records or other storage. */
export function planPatientWorkspaceReset<
  F extends {
    idDocument: { uri: string } | null;
    chiefComplaintDrawing: string | null;
    historyDrawing: string | null;
    attachments: { uri: string }[];
  },
>(workspace: PatientWorkspaceLike<F>, blank: { id: string; form: F }) {
  const uris = [
    ...new Set(
      workspace.patients
        .flatMap(({ form }) => [
          form.idDocument?.uri,
          form.chiefComplaintDrawing,
          form.historyDrawing,
          ...form.attachments.map((item) => item.uri),
        ])
        .filter((uri): uri is string => !!uri),
    ),
  ];
  const next: PatientWorkspaceLike<F> = {
    version: 2,
    activeId: blank.id,
    patients: [blank],
  };
  return { next, uris };
}

/** Never route an asynchronous result through whichever patient is active later. */
export function updatePatientById<F>(
  workspace: PatientWorkspaceLike<F>,
  patientId: string,
  update: (form: F) => F,
): PatientWorkspaceLike<F> {
  if (!workspace.patients.some((patient) => patient.id === patientId))
    throw new Error("Patient no longer exists");
  return {
    ...workspace,
    patients: workspace.patients.map((patient) =>
      patient.id === patientId
        ? { ...patient, form: update(patient.form) }
        : patient,
    ),
  };
}
