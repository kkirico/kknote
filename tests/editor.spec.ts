import {
	_electron as electron,
	expect,
	test,
	type ElectronApplication,
	type Page,
} from "@playwright/test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let app: ElectronApplication;
let page: Page;
let dir: string;
async function launch() {
	const env: Record<string, string> = Object.fromEntries(
		Object.entries(process.env).filter(
			(entry): entry is [string, string] => entry[1] !== undefined,
		),
	);
	env.KKNOTE_DATA_DIR = dir;
	delete env.ELECTRON_RUN_AS_NODE;
	app = await electron.launch({ args: ["."], env });
	page = await app.firstWindow();
	await expect(page.locator(".tiptap")).toBeVisible();
}
test.beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "kknote-e2e-"));
	await launch();
});
test.afterEach(async () => {
	await app?.close();
	await rm(dir, { recursive: true, force: true });
});

test("노션식 입력 규칙과 체크박스가 동작한다", async () => {
	const editor = page.locator(".tiptap");
	await editor.click();
	await page.keyboard.type("# ");
	await page.keyboard.insertText("오늘의 메모");
	await expect(editor.locator("h1")).toHaveText("오늘의 메모");
	await page.keyboard.press("Enter");
	await page.keyboard.type("[] ");
	await page.keyboard.insertText("할 일");
	await editor.locator("input[type=checkbox]").check();
	await expect(editor.locator("input[type=checkbox]")).toBeChecked();
	await expect(page.getByRole("status")).toHaveText("저장됨");
	await app.close();
	await launch();
	await expect(page.locator(".tiptap h1")).toHaveText("오늘의 메모");
	await expect(page.locator(".tiptap input[type=checkbox]")).toBeChecked();
});

test("메모를 빠르게 전환하고 종료해도 마지막 입력을 보존한다", async () => {
	await page.locator(".tiptap").click();
	await page.keyboard.insertText("첫 메모의 마지막 입력");
	await page.getByRole("button", { name: "새 메모", exact: true }).click();
	await page.keyboard.insertText("두 번째 메모");
	await page.keyboard.press("Meta+Shift+[");
	await expect(page.locator(".tiptap")).toContainText("첫 메모의 마지막 입력");
	await page.keyboard.press("Meta+Shift+]");
	await expect(page.locator(".tiptap")).toContainText("두 번째 메모");
	await page.keyboard.insertText(" 종료 직전");
	const exited = new Promise<void>((resolve) =>
		app.process().once("exit", () => resolve()),
	);
	await app.evaluate(({ app }) => app.quit());
	await exited;
	await launch();
	await expect(page.locator(".tiptap")).toContainText("종료 직전");
	const data = JSON.parse(await readFile(join(dir, "notes.json"), "utf8"));
	expect(data.notes).toHaveLength(2);
});

test("선택한 문자열에 링크를 적용하고 위험한 URL은 거부한다", async () => {
	await page.locator(".tiptap").click();
	await page.keyboard.insertText("참고 문서");
	await page.keyboard.press("Meta+a");
	await page.keyboard.press("Meta+k");
	await page.getByLabel("링크 주소").fill("javascript:alert(1)");
	await page.getByRole("button", { name: "적용", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText("http");
	await page.getByLabel("링크 주소").fill("https://example.com/reference");
	await page.getByRole("button", { name: "적용", exact: true }).click();
	await expect(page.locator(".tiptap a")).toHaveAttribute(
		"href",
		"https://example.com/reference",
	);
	await expect(page.locator(".tiptap a")).toHaveText("참고 문서");
});

test("창 닫기는 숨기고 메뉴 동작으로 다시 열며 크기와 위치를 복원한다", async () => {
	await app.evaluate(({ BrowserWindow }) => {
		const win = BrowserWindow.getAllWindows()[0];
		win.setBounds({ x: 100, y: 100, width: 650, height: 620 });
		win.close();
	});
	await expect
		.poll(() =>
			app.evaluate(({ BrowserWindow }) =>
				BrowserWindow.getAllWindows()[0].isVisible(),
			),
		)
		.toBe(false);
	await app.evaluate(({ app }) => app.emit("activate"));
	await expect
		.poll(() =>
			app.evaluate(({ BrowserWindow }) =>
				BrowserWindow.getAllWindows()[0].isVisible(),
			),
		)
		.toBe(true);
	await app.close();
	await launch();
	const bounds = await app.evaluate(({ BrowserWindow }) =>
		BrowserWindow.getAllWindows()[0].getBounds(),
	);
	expect(bounds.width).toBe(650);
	expect(bounds.height).toBe(620);
});

test("한글 조합 이벤트 중에도 입력 문장을 유지한다", async () => {
	const editor = page.locator(".tiptap");
	await editor.click();
	await editor.dispatchEvent("compositionstart", { data: "" });
	await page.keyboard.insertText("한글 입력 중");
	await editor.dispatchEvent("compositionend", { data: "중" });
	await page.keyboard.press("Space");
	await page.keyboard.insertText("이어 쓰기");
	await expect(editor).toHaveText("한글 입력 중 이어 쓰기");
});

test("저장이 실패하면 완료로 표시하지 않고 재시도로 복구한다", async () => {
	await expect(page.getByRole("status")).toHaveText("저장됨");
	await chmod(dir, 0o500);
	try {
		await page.locator(".tiptap").click();
		await page.keyboard.insertText("디스크 오류 중에도 남아야 하는 메모");
		await expect(page.getByRole("status")).toHaveText("저장하지 못했어요");
	} finally {
		await chmod(dir, 0o700);
	}
	await page.getByRole("button", { name: "재시도" }).click();
	await expect(page.getByRole("status")).toHaveText("저장됨");
	expect(await readFile(join(dir, "notes.json"), "utf8")).toContain(
		"디스크 오류 중에도 남아야 하는 메모",
	);
});

test("손상된 파일은 오류를 표시하고 원본을 보존한다", async () => {
	await app.close();
	await writeFile(join(dir, "notes.json"), "{broken");
	const env = { ...process.env, KKNOTE_DATA_DIR: dir } as Record<
		string,
		string
	>;
	delete env.ELECTRON_RUN_AS_NODE;
	app = await electron.launch({ args: ["."], env });
	page = await app.firstWindow();
	await expect(
		page.getByRole("heading", { name: "메모를 불러오지 못했어요" }),
	).toBeVisible();
	expect(await readFile(join(dir, "notes.json"), "utf8")).toBe("{broken");
});

test("삭제는 확인 후 수행하고 마지막 메모 뒤에도 입력할 수 있다", async () => {
	await page.locator(".tiptap").click();
	await page.keyboard.insertText("남겨둔 메모");
	await page.getByRole("button", { name: "메모 메뉴" }).click();
	await page.getByRole("menuitem", { name: "메모 삭제…" }).click();
	await page.getByRole("button", { name: "취소", exact: true }).click();
	await expect(page.locator(".tiptap")).toHaveText("남겨둔 메모");
	await page.getByRole("button", { name: "메모 메뉴" }).click();
	await page.getByRole("menuitem", { name: "메모 삭제…" }).click();
	await page.getByRole("button", { name: "삭제", exact: true }).click();
	await page.keyboard.insertText("다시 시작");
	await expect(page.locator(".tiptap")).toHaveText("다시 시작");
	await expect(page.locator(".page-count")).toHaveText("1/1");
});

test("링크 편집 중 Tab 포커스는 대화상자 안에 머문다", async () => {
	await page.getByRole("button", { name: "링크 삽입" }).click();
	for (let i = 0; i < 8; i++) {
		await page.keyboard.press("Tab");
		expect(
			await page.evaluate(() =>
				Boolean(document.activeElement?.closest("[role=dialog]")),
			),
		).toBe(true);
	}
});

test("브라우저 IME 조합 중 네이티브 메뉴로 이동해도 조합 글자를 보존한다", async () => {
	await page.locator(".tiptap").click();
	await page.keyboard.insertText("입력 중 ");
	const session = await page.context().newCDPSession(page);
	await session.send("Input.imeSetComposition", {
		text: "한",
		selectionStart: 1,
		selectionEnd: 1,
	});
	await expect(page.locator(".tiptap")).toContainText("입력 중 한");
	await app.evaluate(({ Menu }) => {
		const notes = Menu.getApplicationMenu()!.items.find(
			(item) => item.label === "메모",
		)!;
		notes.submenu!.items.find((item) => item.label === "새 메모")!.click();
	});
	await page.getByRole("button", { name: "이전 메모", exact: true }).click();
	await expect(page.locator(".tiptap")).toContainText("입력 중 한");
});

test("브라우저 IME 조합 중 종료해도 마지막 글자를 저장한다", async () => {
	await page.locator(".tiptap").click();
	const session = await page.context().newCDPSession(page);
	await session.send("Input.imeSetComposition", {
		text: "메모한",
		selectionStart: 3,
		selectionEnd: 3,
	});
	await expect(page.locator(".tiptap")).toContainText("메모한");
	const exited = new Promise<void>((resolve) =>
		app.process().once("exit", () => resolve()),
	);
	await app.evaluate(({ app }) => app.quit());
	await exited;
	await launch();
	await expect(page.locator(".tiptap")).toContainText("메모한");
});

test("전역 단축키와 같은 메뉴 동작은 앞에 있으면 숨기고 숨겨져 있으면 연다", async () => {
	await page.locator(".tiptap").click();
	await page.keyboard.insertText("숨기기 직전 메모");
	await app.evaluate(({ BrowserWindow }) =>
		BrowserWindow.getAllWindows()[0].focus(),
	);
	await expect
		.poll(() =>
			app.evaluate(({ BrowserWindow }) =>
				BrowserWindow.getAllWindows()[0].isFocused(),
			),
		)
		.toBe(true);
	const toggle = () =>
		app.evaluate(({ Menu }) => {
			Menu.getApplicationMenu()!
				.items[0].submenu!.items.find(
					(item) => item.label === "메모 열기/숨기기",
				)!
				.click();
		});
	await toggle();
	await expect
		.poll(() =>
			app.evaluate(({ BrowserWindow }) =>
				BrowserWindow.getAllWindows()[0].isVisible(),
			),
		)
		.toBe(false);
	expect(await readFile(join(dir, "notes.json"), "utf8")).toContain(
		"숨기기 직전 메모",
	);
	expect(await app.evaluate(({ app }) => app.isHidden())).toBe(true);
	await toggle();
	await expect
		.poll(() =>
			app.evaluate(({ BrowserWindow }) =>
				BrowserWindow.getAllWindows()[0].isVisible(),
			),
		)
		.toBe(true);
	expect(await app.evaluate(({ app }) => app.isHidden())).toBe(false);
});

test("표준 마크다운 체크리스트를 입력하면 미완료와 완료 체크박스로 변환한다", async () => {
	await page.locator(".tiptap").click();
	await page.keyboard.type("- [ ] ");
	await page.keyboard.insertText("미완료 항목");
	await expect(page.locator(".tiptap input[type=checkbox]")).toHaveCount(1);
	await expect(page.locator(".tiptap input[type=checkbox]")).not.toBeChecked();
	await page.keyboard.press("Enter");
	await page.keyboard.press("Enter");
	await page.keyboard.type("- [x] ");
	await page.keyboard.insertText("완료 항목");
	await expect(page.locator(".tiptap input[type=checkbox]")).toHaveCount(2);
	await expect(
		page.locator(".tiptap input[type=checkbox]").nth(1),
	).toBeChecked();
});

test("커맨드 N은 현재 위치와 관계없이 맨 뒤에 새 메모를 추가한다", async () => {
	await page.keyboard.insertText("첫 메모");
	await page.keyboard.press("Meta+n");
	await page.keyboard.insertText("둘째 메모");
	await page.getByRole("button", { name: "이전 메모", exact: true }).click();
	await expect(page.locator(".tiptap")).toHaveText("첫 메모");
	await page.keyboard.press("Meta+n");
	await expect(page.locator(".page-count")).toHaveText("3/3");
	await page.keyboard.insertText("맨 뒤 새 메모");
	await page.getByRole("button", { name: "이전 메모", exact: true }).click();
	await expect(page.locator(".tiptap")).toHaveText("둘째 메모");
});
