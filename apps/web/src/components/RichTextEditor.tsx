import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import type { ProseMirrorDoc } from "../types/page";

interface RichTextEditorProps {
  initialContent: ProseMirrorDoc;
  disabled?: boolean;
  onChange: (nextDoc: ProseMirrorDoc) => void;
}

export function RichTextEditor({
  initialContent,
  disabled = false,
  onChange,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder:
          "Escreva suas anotações, listas de estudo, checklists ou citações...",
      }),
    ],
    content: initialContent,
    editable: !disabled,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getJSON() as ProseMirrorDoc);
    },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== !disabled) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  if (!editor) {
    return (
      <div className="editor-loading muted">Inicializando editor visual...</div>
    );
  }

  return (
    <div className="editor-shell">
      <div
        className="editor-toolbar"
        role="toolbar"
        aria-label="Formatação de texto"
      >
        <button
          type="button"
          className={`toolbar-btn ${editor.isActive("heading", { level: 1 }) ? "is-active" : ""}`}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Título 1"
        >
          H1
        </button>
        <button
          type="button"
          className={`toolbar-btn ${editor.isActive("heading", { level: 2 }) ? "is-active" : ""}`}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Título 2"
        >
          H2
        </button>
        <button
          type="button"
          className={`toolbar-btn ${editor.isActive("heading", { level: 3 }) ? "is-active" : ""}`}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Título 3"
        >
          H3
        </button>

        <span className="toolbar-divider" aria-hidden="true" />

        <button
          type="button"
          className={`toolbar-btn ${editor.isActive("bold") ? "is-active" : ""}`}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`toolbar-btn ${editor.isActive("italic") ? "is-active" : ""}`}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico"
        >
          <em>I</em>
        </button>

        <span className="toolbar-divider" aria-hidden="true" />

        <button
          type="button"
          className={`toolbar-btn ${editor.isActive("bulletList") ? "is-active" : ""}`}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Lista com marcadores"
        >
          • Lista
        </button>
        <button
          type="button"
          className={`toolbar-btn ${editor.isActive("orderedList") ? "is-active" : ""}`}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Lista numerada"
        >
          1. Lista
        </button>
        <button
          type="button"
          className={`toolbar-btn ${editor.isActive("taskList") ? "is-active" : ""}`}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Checklist"
        >
          ☑ Checklist
        </button>
        <button
          type="button"
          className={`toolbar-btn ${editor.isActive("blockquote") ? "is-active" : ""}`}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Citação"
        >
          “ Citação
        </button>

        <span className="toolbar-divider" aria-hidden="true" />

        <button
          type="button"
          className="toolbar-btn"
          disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="Desfazer"
        >
          ↶
        </button>
        <button
          type="button"
          className="toolbar-btn"
          disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title="Refazer"
        >
          ↷
        </button>
      </div>

      <EditorContent editor={editor} className="editor-canvas" />
    </div>
  );
}
