"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Strikethrough, Heading2, Heading3,
  List, ListOrdered, Quote, Link2, ImageIcon, Undo, Redo, Loader2,
} from "lucide-react";

type Props = {
  content?: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export default function TiptapEditor({ content = "", onChange, placeholder }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-brand underline" } }),
      Image.configure({ HTMLAttributes: { class: "rounded-lg max-w-full" } }),
      Placeholder.configure({ placeholder: placeholder ?? "Yazmaya başlayın…" }),
      CharacterCount,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "min-h-[300px] prose prose-sm max-w-none p-4 focus:outline-none",
      },
    },
    immediatelyRender: false,
  });

  if (!editor) return null;

  function addLink() {
    const url = window.prompt("URL:");
    if (!url) return;
    editor!.chain().focus().setLink({ href: url }).run();
  }

  // 2026-09-18 kullanıcı talebi ("nereye yüklemem gerek") — eskiden yalnız harici bir URL
  // yapıştırılabiliyordu (window.prompt), kullanıcının yükleyeceği bir yer YOKTU. Artık
  // dosya seçici gerçek bir upload endpoint'ine (bkz. /api/admin/upload-article-image,
  // upload-banner/route.ts ile AYNI desen) yüklüyor; URL yapıştırma da (harici görsel
  // bağlantısı için) ayrı seçenek olarak KORUNUYOR.
  function addImageFromFile() {
    fileInputRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-article-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Yükleme başarısız");
      editor!.chain().focus().setImage({ src: data.url }).run();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görsel yüklenemedi");
    } finally {
      setUploading(false);
    }
  }

  function addImageFromUrl() {
    const url = window.prompt("Görsel URL:");
    if (!url) return;
    editor!.chain().focus().setImage({ src: url }).run();
  }

  const btnClass = (active: boolean) =>
    cn(
      "rounded p-1.5 text-sm transition-colors",
      active ? "bg-brand text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  return (
    <div className="rounded-lg border">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 border-b p-2">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive("bold"))}>
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive("italic"))}>
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive("strike"))}>
          <Strikethrough className="h-3.5 w-3.5" />
        </button>
        <div className="mx-1 w-px bg-border" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive("heading", { level: 2 }))}>
          <Heading2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive("heading", { level: 3 }))}>
          <Heading3 className="h-3.5 w-3.5" />
        </button>
        <div className="mx-1 w-px bg-border" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive("bulletList"))}>
          <List className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive("orderedList"))}>
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive("blockquote"))}>
          <Quote className="h-3.5 w-3.5" />
        </button>
        <div className="mx-1 w-px bg-border" />
        <button type="button" onClick={addLink} className={btnClass(editor.isActive("link"))}>
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFileSelected} className="hidden" />
        <button type="button" onClick={addImageFromFile} disabled={uploading} title="Bilgisayardan görsel yükle" className={btnClass(false)}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
        </button>
        <button type="button" onClick={addImageFromUrl} title="Görsel URL'i yapıştır" className={cn(btnClass(false), "text-[10px] font-semibold")}>
          URL
        </button>
        <div className="mx-1 w-px bg-border" />
        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={btnClass(false)}>
          <Undo className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={btnClass(false)}>
          <Redo className="h-3.5 w-3.5" />
        </button>
      </div>

      <EditorContent editor={editor} />

      <div className="border-t px-4 py-1.5 text-right text-[10px] text-muted-foreground">
        {editor.storage.characterCount?.characters() ?? 0} karakter
      </div>
    </div>
  );
}
