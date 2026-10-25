import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { PatientFileCleanup } from "./patientFileCleanup";
import { useNoteAlert } from "./NoteDialogs";

export function usePatientFileCleanup(retained: (uri: string) => boolean) {
  const alert = useNoteAlert();
  const retainedRef = useRef(retained);
  retainedRef.current = retained;
  const [cleanup] = useState(() => new PatientFileCleanup(
    uri => FileSystem.deleteAsync(uri, { idempotent: true }),
    uri => retainedRef.current(uri),
  ));
  const cleanupFiles = useCallback(async (uris: (string | null | undefined)[]): Promise<void> => {
    const remaining = await cleanup.remove(uris);
    if (remaining) alert("파일 정리 필요", "일부 임시·첨부 파일을 삭제하지 못했습니다. 기기에 남은 파일 정리를 다시 시도해 주세요.", [
      { text: "닫기", style: "cancel" },
      { text: "재시도", onPress: () => cleanupFiles([]) },
    ]);
  }, [alert, cleanup]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => {
      if (state === "active") void cleanupFiles([]);
    });
    return () => listener.remove();
  }, [cleanupFiles]);
  return cleanupFiles;
}
