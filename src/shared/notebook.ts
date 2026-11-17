import type { JSONContent, Note, Notebook } from "./types";

function emptyNote(): Note {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		content: { type: "doc", content: [{ type: "paragraph" }] },
		createdAt: now,
		updatedAt: now,
	};
}
export function createNotebook(): Notebook {
	const note = emptyNote();
	return { version: 1, notes: [note], activeId: note.id };
}
export function createNote(book: Notebook): Notebook {
	const note = emptyNote();
	return { ...book, notes: [...book.notes, note], activeId: note.id };
}
export function moveNote(book: Notebook, delta: number): Notebook {
	const i = book.notes.findIndex((n) => n.id === book.activeId);
	return {
		...book,
		activeId:
			book.notes[
				(((i + delta) % book.notes.length) + book.notes.length) %
					book.notes.length
			].id,
	};
}
export function deleteNote(book: Notebook, id: string): Notebook {
	const index = book.notes.findIndex((n) => n.id === id);
	const notes = book.notes.filter((n) => n.id !== id);
	if (!notes.length) return createNotebook();
	return {
		...book,
		notes,
		activeId:
			id === book.activeId
				? notes[Math.min(index, notes.length - 1)].id
				: book.activeId,
	};
}
export function updateContent(book: Notebook, content: JSONContent): Notebook {
	return {
		...book,
		notes: book.notes.map((n) =>
			n.id === book.activeId
				? { ...n, content, updatedAt: new Date().toISOString() }
				: n,
		),
	};
}

const nodes = new Set([
	"doc",
	"paragraph",
	"text",
	"heading",
	"bulletList",
	"orderedList",
	"listItem",
	"taskList",
	"taskItem",
	"blockquote",
	"codeBlock",
	"hardBreak",
	"horizontalRule",
]);
const marks = new Set([
	"bold",
	"italic",
	"strike",
	"code",
	"link",
	"underline",
]);
function validNode(value: unknown, depth = 0): value is JSONContent {
	if (depth > 100 || !value || typeof value !== "object") return false;
	const node = value as JSONContent;
	return (
		typeof node.type === "string" &&
		nodes.has(node.type) &&
		(node.text === undefined || typeof node.text === "string") &&
		(node.attrs === undefined ||
			(!!node.attrs &&
				typeof node.attrs === "object" &&
				!Array.isArray(node.attrs))) &&
		(node.content === undefined ||
			(Array.isArray(node.content) &&
				node.content.every((n) => validNode(n, depth + 1)))) &&
		(node.marks === undefined ||
			(Array.isArray(node.marks) && node.marks.every((m) => marks.has(m.type))))
	);
}
export function validateNotebook(value: unknown): Notebook {
	const b = value as Notebook | null;
	if (
		!b ||
		b.version !== 1 ||
		!Array.isArray(b.notes) ||
		!b.notes.length ||
		!b.notes.every(
			(n) =>
				n &&
				typeof n.id === "string" &&
				n.id.length > 0 &&
				typeof n.createdAt === "string" &&
				typeof n.updatedAt === "string" &&
				n.content?.type === "doc" &&
				validNode(n.content),
		) ||
		new Set(b.notes.map((n) => n.id)).size !== b.notes.length ||
		!b.notes.some((n) => n.id === b.activeId)
	) {
		throw new Error(
			"메모 파일 형식을 읽을 수 없습니다. 원본 파일은 그대로 보존됩니다.",
		);
	}
	return b;
}
