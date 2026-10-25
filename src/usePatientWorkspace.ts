import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type SetStateAction } from "react";
import { PatientStorage } from "./patientStorage";
import type { FormState } from "./patientWorkspace";

export function usePatientWorkspace(onSaveError: () => void) {
  const errorRef = useRef(onSaveError);
  errorRef.current = onSaveError;
  const [store] = useState(() => new PatientStorage(AsyncStorage, () => errorRef.current()));
  const { workspace, status, busy } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    void store.restore();
    const listener = AppState.addEventListener("change", state => {
      if (state !== "active") void store.flush().catch(() => errorRef.current());
    });
    return () => {
      listener.remove();
      void store.flush().catch(() => errorRef.current());
    };
  }, [store]);
  const setForm = useCallback((update: SetStateAction<FormState>) => {
    store.edit(previous => typeof update === "function" ? update(previous) : update);
  }, [store]);
  return {
    store, workspace, status, busy, setForm,
    form: workspace.patients.find(patient => patient.id === workspace.activeId)!.form,
    patients: workspace.patients,
    activePatientId: workspace.activeId,
    commitPatientUpdate: (id: string, update: (previous: FormState) => FormState) => store.commit(id, update),
  };
}
