import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadNotebook, saveNotebook } from "./store";

let dir: string;
let path: string;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "kknote-store-"));
	path = join(dir, "notes.json");
});
afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("영구 저장", () => {
	it("첫 실행에는 메모 하나를 만들고 재실행해도 같은 메모를 불러온다", async () => {
		const book = await loadNotebook(path);
		expect(book.notes).toHaveLength(1);
		expect(book.activeId).toBe(book.notes[0].id);
		await saveNotebook(path, book);
		expect(await loadNotebook(path)).toEqual(book);
	});
	it("한글, 체크 상태, 링크와 서식을 손실 없이 복원한다", async () => {
		const book = await loadNotebook(path);
		book.notes[0].content = {
			type: "doc",
			content: [
				{
					type: "taskList",
					content: [
						{
							type: "taskItem",
							attrs: { checked: true },
							content: [
								{
									type: "paragraph",
									content: [{ type: "text", text: "한글 메모" }],
								},
							],
						},
					],
				},
				{
					type: "paragraph",
					content: [
						{
							type: "text",
							text: "문서",
							marks: [{ type: "link", attrs: { href: "https://example.com" } }],
						},
					],
				},
			],
		};
		await saveNotebook(path, book);
		expect((await loadNotebook(path)).notes[0].content).toEqual(
			book.notes[0].content,
		);
	});
	it("빠르게 요청한 저장도 마지막 요청의 내용이 남는다", async () => {
		const book = await loadNotebook(path);
		await Promise.all(
			Array.from({ length: 20 }, (_, i) => {
				const snapshot = structuredClone(book);
				snapshot.notes[0].content = {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: `메모 ${i}` }],
						},
					],
				};
				return saveNotebook(path, snapshot);
			}),
		);
		expect(await readFile(path, "utf8")).toContain("메모 19");
		expect(await readdir(dir)).toEqual(["notes.json"]);
	});
	it("손상된 파일을 덮어쓰지 않고 오류를 알린다", async () => {
		await writeFile(path, "{broken");
		await expect(loadNotebook(path)).rejects.toThrow();
		expect(await readFile(path, "utf8")).toBe("{broken");
	});
	it("유효하지 않은 저장 구조를 거부한다", async () => {
		await writeFile(
			path,
			JSON.stringify({ version: 1, notes: [], activeId: "missing" }),
		);
		await expect(loadNotebook(path)).rejects.toThrow();
	});
	it("쓰기 실패를 전달하고 다음 저장을 막지 않는다", async () => {
		const book = await loadNotebook(path);
		const badPath = join(dir, "missing", "notes.json");
		await expect(saveNotebook(badPath, book)).rejects.toThrow();
		await saveNotebook(path, book);
		expect(await loadNotebook(path)).toEqual(book);
	});
});
