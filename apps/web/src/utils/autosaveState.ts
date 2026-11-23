export type PostSaveTransition = {
  stillDirty: boolean;
  nextSaveState: "saved" | "dirty";
};

/**
 * Prevents concurrent PATCH requests with the same expectedVersion,
 * which would otherwise cause self-inflicted 409 conflicts.
 */
export function canStartAutosave(isSaving: boolean, isDirty: boolean): boolean {
  return !isSaving && isDirty;
}

/**
 * Determines whether edits arrived while a save request was in-flight.
 * Only transitions to "saved" when no newer edit happened after the save began.
 */
export function resolvePostSaveState(
  editSeqAtSaveStart: number,
  currentEditSeq: number
): PostSaveTransition {
  if (currentEditSeq > editSeqAtSaveStart) {
    return { stillDirty: true, nextSaveState: "dirty" };
  }
  return { stillDirty: false, nextSaveState: "saved" };
}
