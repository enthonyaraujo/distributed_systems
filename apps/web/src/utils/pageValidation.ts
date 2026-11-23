import type { ProseMirrorDoc } from "../types/page";

export const MAX_PAGE_TITLE_LEN = 120;
export const MAX_PAGE_ICON_LEN = 8;
export const MAX_PAGE_CONTENT_BYTES = 102_400; // 100 KB UTF-8

export function validatePageTitle(rawTitle: string): string | null {
  const cleaned = rawTitle.trim();
  if (cleaned.length < 1 || cleaned.length > MAX_PAGE_TITLE_LEN) {
    return `O título da página deve ter entre 1 e ${MAX_PAGE_TITLE_LEN} caracteres.`;
  }
  return null;
}

export function validatePageIcon(rawIcon: string): string | null {
  const cleaned = rawIcon.trim();
  if (cleaned.length > MAX_PAGE_ICON_LEN) {
    return `O ícone deve ter no máximo ${MAX_PAGE_ICON_LEN} caracteres.`;
  }
  return null;
}

export function estimateContentBytes(content: ProseMirrorDoc): number {
  return new TextEncoder().encode(JSON.stringify(content)).length;
}

export function validatePageContentSize(content: ProseMirrorDoc): string | null {
  if (estimateContentBytes(content) > MAX_PAGE_CONTENT_BYTES) {
    return "O conteúdo excede o limite de 100 KB por página. Divida em outra página para salvar.";
  }
  return null;
}
