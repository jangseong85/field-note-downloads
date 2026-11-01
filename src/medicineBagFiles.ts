import * as FileSystem from "expo-file-system/legacy";

/**
 * Every medicine-bag photo, crop and masked copy lives here and nowhere else, so one delete
 * removes them all: on close, after returning from ChatGPT, and at the next app start.
 */
const directory = () => (FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}medicine-bag/` : null);

/** Moves a temporary image (camera, manipulator or snapshot cache) into the medicine-bag folder. */
export async function keepMedicineBagFile(uri: string): Promise<string> {
  const folder = directory();
  if (!folder) throw new Error("Storage unavailable");
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const target = `${folder}medicine-bag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await FileSystem.moveAsync({ from: uri, to: target });
  return target;
}

export async function clearMedicineBagFiles(): Promise<void> {
  const folder = directory();
  if (folder) await FileSystem.deleteAsync(folder, { idempotent: true }).catch(() => undefined);
}
