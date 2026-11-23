import { describe, expect, it } from "vitest";
import {
  MAX_PAGE_CONTENT_BYTES,
  validatePageContentSize,
  validatePageIcon,
  validatePageTitle,
} from "./pageValidation";

describe("pageValidation", () => {
  it("accepts valid title, icon and structured document", () => {
    expect(validatePageTitle("Resumo de Sistemas Distribuídos")).toBeNull();
    expect(validatePageIcon("📘")).toBeNull();
    expect(
      validatePageContentSize({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Ok" }] }],
      })
    ).toBeNull();
  });

  it("rejects empty title, long icon and documents exceeding 100 KB", () => {
    expect(validatePageTitle("   ")).toBeTruthy();
    expect(validatePageTitle("a".repeat(121))).toBeTruthy();
    expect(validatePageIcon("123456789")).toBeTruthy();
    expect(
      validatePageContentSize({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x".repeat(MAX_PAGE_CONTENT_BYTES + 10) }],
          },
        ],
      })
    ).toBeTruthy();
  });
});
