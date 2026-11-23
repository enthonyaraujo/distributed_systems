import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import type { ProseMirrorDoc } from "../types/page";
import {
  IconChecklist,
  IconListBullet,
  IconListOrdered,
  IconQuote,
  IconRedo,
  IconUndo,
} from "./Icons";

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
          "Escreva suas anotações, listas de estudo, checklists ou citações…",
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
      <div className="editor-loading muted">
        <span className="spinner" aria-hidden="true" />
        <span>Inicializando editor visual…</span>
      </div>
    );
  }

  return (
    <div className="editor-shell">
      <div
        className="editor-toolbar"
        role="toolbar"
        aria-label="Formatação de texto"
      >
        <div className="toolbar-group" role="group" aria-label="Títulos">
          <button
            type="button"
            className={`toolbar-btn ${editor.isActive("heading", { level: 1 }) ? "is-active" : ""}`}
            aria-pressed={editor.isActive("heading", { level: 1 })}
            disabled={disabled}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            title="Título 1"
          >
            H1
          </button>
          <button
            type="button"
            className={`toolbar-btn ${editor.isActive("heading", { level: 2 }) ? "is-active" : ""}`}
            aria-pressed={editor.isActive("heading", { level: 2 })}
            disabled={disabled}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            title="Título 2"
          >
            H2
          </button>
          <button
            type="button"
            className={`toolbar-btn ${editor.isActive("heading", { level: 3 }) ? "is-active" : ""}`}
            aria-pressed={editor.isActive("heading", { level: 3 })}
            disabled={disabled}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            title="Título 3"
          >
            H3
          </button>
        </div>

        <span className="toolbar-divider" aria-hidden="true" />

        <div className="toolbar-group" role="group" aria-label="Ênfase">
          <button
            type="button"
            className={`toolbar-btn ${editor.isActive("bold") ? "is-active" : ""}`}
            aria-pressed={editor.isActive("bold")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Negrito"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={`toolbar-btn ${editor.isActive("italic") ? "is-active" : ""}`}
            aria-pressed={editor.isActive("italic")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Itálico"
          >
            <em>I</em>
          </button>
        </div>

        <span className="toolbar-divider" aria-hidden="true" />

        <div
          className="toolbar-group"
          role="group"
          aria-label="Listas e blocos"
        >
          <button
            type="button"
            className={`toolbar-btn ${editor.isActive("bulletList") ? "is-active" : ""}`}
            aria-pressed={editor.isActive("bulletList")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Lista com marcadores"
          >
            <IconListBullet size={15} />
            <span>Lista</span>
          </button>
          <button
            type="button"
            className={`toolbar-btn ${editor.isActive("orderedList") ? "is-active" : ""}`}
            aria-pressed={editor.isActive("orderedList")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Lista numerada"
          >
            <IconListOrdered size={15} />
            <span>Numerada</span>
          </button>
          <button
            type="button"
            className={`toolbar-btn ${editor.isActive("taskList") ? "is-active" : ""}`}
            aria-pressed={editor.isActive("taskList")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            title="Checklist"
          >
            <IconChecklist size={15} />
            <span>Checklist</span>
          </button>
          <button
            type="button"
            className={`toolbar-btn ${editor.isActive("blockquote") ? "is-active" : ""}`}
            aria-pressed={editor.isActive("blockquote")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Citação"
          >
            <IconQuote size={15} />
            <span>Citação</span>
          </button>
        </div>

        <span className="toolbar-divider" aria-hidden="true" />

        <div className="toolbar-group" role="group" aria-label="Histórico">
          <button
            type="button"
            className="toolbar-btn"
            disabled={disabled || !editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
            title="Desfazer"
            aria-label="Desfazer"
          >
            <IconUndo size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            disabled={disabled || !editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
            title="Refazer"
            aria-label="Refazer"
          >
            <IconRedo size={15} />
          </button>
        </div>
      </div>

      <EditorContent editor={editor} className="editor-canvas" />
    </div>
  );
}
