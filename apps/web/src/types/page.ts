export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

export interface ProseMirrorDoc {
  type: "doc";
  content: ProseMirrorNode[];
}

export const EMPTY_PROSEMIRROR_DOC: ProseMirrorDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export interface PageSummary {
  id: string;
  title: string;
  icon: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Page extends PageSummary {
  content: ProseMirrorDoc;
}

export interface CreatePageInput {
  title: string;
  icon?: string;
  content?: ProseMirrorDoc;
}

export interface UpdatePageInput {
  title?: string;
  icon?: string;
  content?: ProseMirrorDoc;
  expectedVersion?: number;
}
