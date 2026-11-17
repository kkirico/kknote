import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { InputRule } from "@tiptap/react";

const MarkdownTaskItem = TaskItem.extend({
	addInputRules() {
		return [
			new InputRule({
				find: /^\s*(?:[-+*]\s+)?\[([ xX]?)\]\s$/,
				handler: ({ chain, range, match }) => {
					const commands = chain().deleteRange(range);
					if (!this.editor.isActive("taskList")) commands.toggleTaskList();
					commands
						.updateAttributes(this.name, {
							checked: match[1].toLowerCase() === "x",
						})
						.run();
				},
			}),
		];
	},
});

export const extensions = [
	StarterKit.configure({
		heading: { levels: [1, 2, 3] },
		link: {
			openOnClick: false,
			autolink: true,
			protocols: ["mailto"],
			isAllowedUri: (url) => {
				try {
					return ["https:", "http:", "mailto:"].includes(new URL(url).protocol);
				} catch {
					return false;
				}
			},
			HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
		},
	}),
	TaskList,
	MarkdownTaskItem.configure({
		nested: true,
		a11y: { checkboxLabel: (node) => node.textContent || "할 일" },
	}),
	Placeholder.configure({
		placeholder: "생각을 적어보세요…",
		showOnlyCurrent: true,
	}),
];
