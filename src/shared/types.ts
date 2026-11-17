import type { JSONContent } from "@tiptap/react";

export type { JSONContent };
export interface Note {
	id: string;
	content: JSONContent;
	createdAt: string;
	updatedAt: string;
}
export interface Notebook {
	version: 1;
	notes: Note[];
	activeId: string;
}
export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}
