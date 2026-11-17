import {
	EditorContent,
	useEditor,
	type Editor as TiptapEditor,
} from "@tiptap/react";
import { useLayoutEffect } from "react";
import type { JSONContent } from "../shared/types";
import { extensions } from "./extensions";

interface Props {
	content: JSONContent;
	onChange: (content: JSONContent) => void;
	onReady: (editor: TiptapEditor | null) => void;
	onLink: () => void;
}
export function Editor({ content, onChange, onReady, onLink }: Props) {
	const editor = useEditor({
		extensions,
		content,
		autofocus: false,
		enableContentCheck: true,
		onUpdate: ({ editor }) => onChange(editor.getJSON()),
		editorProps: {
			attributes: {
				"aria-label": "메모 본문",
				role: "textbox",
				"aria-multiline": "true",
			},
			handleKeyDown: (_view, event) => {
				if (event.isComposing) return false;
				if (
					(event.metaKey || event.ctrlKey) &&
					event.key.toLowerCase() === "k"
				) {
					event.preventDefault();
					onLink();
					return true;
				}
				return false;
			},
			handleClick: (_view, _pos, event) => {
				const link = (event.target as Element).closest("a");
				if (link && (event.metaKey || event.ctrlKey)) {
					event.preventDefault();
					void window.kknote.openExternal(link.href);
					return true;
				}
				return false;
			},
		},
	});
	useLayoutEffect(() => {
		if (!editor) return;
		onReady(editor);
		editor.commands.setTextSelection(editor.state.doc.content.size);
		editor.view.focus();
		return () => onReady(null);
	}, [editor]);
	return <EditorContent editor={editor} className="editor-container" />;
}
