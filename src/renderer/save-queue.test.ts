import { describe, expect, it } from "vitest";
import { SaveQueue } from "./save-queue";
import { createNotebook, updateContent } from "../shared/notebook";

describe("저장 수명주기", () => {
	it("대기 중인 입력도 flush가 끝나면 모두 저장된다", async () => {
		let saved = "";
		const queue = new SaveQueue(
			async (book) => {
				await new Promise((r) => setTimeout(r, 5));
				saved = JSON.stringify(book);
			},
			() => {},
		);
		const book = createNotebook();
		queue.request(book);
		const flush = queue.flush();
		queue.request(
			updateContent(book, {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "종료 직전 한글" }],
					},
				],
			}),
		);
		await flush;
		expect(saved).toContain("종료 직전 한글");
	});
	it("쓰기 실패를 표시하고 재시도하면 같은 내용을 저장한다", async () => {
		let fail = true;
		let saved = "";
		const states: string[] = [];
		const queue = new SaveQueue(
			async (book) => {
				if (fail) throw new Error("disk full");
				saved = JSON.stringify(book);
			},
			(s) => states.push(s),
		);
		queue.request(createNotebook());
		await expect(queue.flush()).rejects.toThrow("disk full");
		expect(states.at(-1)).toBe("error");
		expect(states).not.toContain("saved");
		fail = false;
		await queue.flush();
		expect(saved).toContain("activeId");
		expect(states.at(-1)).toBe("saved");
	});
});
