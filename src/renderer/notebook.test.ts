import { describe, expect, it } from "vitest";
import {
	createNotebook,
	createNote,
	deleteNote,
	moveNote,
	updateContent,
	validateNotebook,
} from "../shared/notebook";

describe("메모 탐색", () => {
	it("새 메모는 끝에 추가하고 즉시 선택한다", () => {
		const before = createNotebook();
		const after = createNote(before);
		expect(after.notes).toHaveLength(2);
		expect(after.activeId).toBe(after.notes[1].id);
		expect(before.notes).toHaveLength(1);
	});
	it("양 끝에서 순환하고 본문을 보존한다", () => {
		let book = createNote(createNotebook());
		book = updateContent(book, {
			type: "doc",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "마지막 입력" }] },
			],
		});
		const first = moveNote(book, 1);
		expect(first.activeId).toBe(first.notes[0].id);
		expect(
			moveNote(first, -1).notes[1].content.content?.[0].content?.[0].text,
		).toBe("마지막 입력");
		expect(moveNote(first, -1).activeId).toBe(first.notes[1].id);
	});
	it("마지막 메모를 삭제해도 빈 메모 하나를 유지한다", () => {
		const book = createNotebook();
		const after = deleteNote(book, book.activeId);
		expect(after.notes).toHaveLength(1);
		expect(after.activeId).not.toBe(book.activeId);
	});
	it("삭제 후 인접 메모를 선택한다", () => {
		const book = createNote(createNotebook());
		expect(deleteNote(book, book.activeId).activeId).toBe(book.notes[0].id);
	});
	it("알 수 없는 노드나 중복 id가 담긴 저장은 거부한다", () => {
		const book = createNotebook();
		expect(() =>
			validateNotebook({ ...book, notes: [book.notes[0], book.notes[0]] }),
		).toThrow();
		book.notes[0].content = { type: "doc", content: [{ type: "script" }] };
		expect(() => validateNotebook(book)).toThrow();
	});
});
