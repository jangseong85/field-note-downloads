/** A retryable transfer: move out of cache, then durably register the file. */
export type MediaSaveTask<T> = {
  sourceUri: string;
  directory: string;
  savedUri: string;
  value: T;
  moved: boolean;
  committed: boolean;
};

export type MediaFileSystem = {
  makeDirectoryAsync: (
    uri: string,
    options: { intermediates: boolean },
  ) => Promise<void>;
  moveAsync: (options: { from: string; to: string }) => Promise<void>;
};

export function createMediaSaveTask<T>(
  sourceUri: string,
  directory: string,
  filename: string,
  value: (savedUri: string) => T,
): MediaSaveTask<T> {
  const savedUri = directory + filename;
  return {
    sourceUri,
    directory,
    savedUri,
    value: value(savedUri),
    moved: false,
    committed: false,
  };
}

export async function runMediaSave<T>(
  task: MediaSaveTask<T>,
  files: MediaFileSystem,
  commit: (value: T) => Promise<void>,
): Promise<void> {
  if (!task.moved) {
    await files.makeDirectoryAsync(task.directory, { intermediates: true });
    // Unlike copyAsync, this does not leave a second patient file in cache.
    await files.moveAsync({ from: task.sourceUri, to: task.savedUri });
    task.moved = true;
  }
  if (!task.committed) {
    await commit(task.value);
    task.committed = true;
  }
}
