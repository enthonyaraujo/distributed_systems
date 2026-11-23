import { describe, expect, it } from "vitest";
import { canStartAutosave, resolvePostSaveState } from "./autosaveState";

describe("autosaveState", () => {
  it("blocks duplicate saves while a request is already in flight", () => {
    expect(canStartAutosave(true, true)).toBe(false);
    expect(canStartAutosave(false, false)).toBe(false);
    expect(canStartAutosave(false, true)).toBe(true);
  });

  it("marks saved only when no edits occurred during the in-flight request", () => {
    expect(resolvePostSaveState(3, 3)).toEqual({
      stillDirty: false,
      nextSaveState: "saved",
    });
  });

  it("keeps dirty state when user typed while save was in progress", () => {
    expect(resolvePostSaveState(3, 5)).toEqual({
      stillDirty: true,
      nextSaveState: "dirty",
    });
  });
});
