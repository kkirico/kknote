import {
	app,
	BrowserWindow,
	dialog,
	globalShortcut,
	ipcMain,
	Menu,
	nativeImage,
	screen,
	shell,
	Tray,
} from "electron";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppCommand } from "../shared/api";
import type { Bounds } from "../shared/types";
import { validateNotebook } from "../shared/notebook";
import { loadNotebook, saveNotebook } from "./store";
import { restoreBounds, safeExternalUrl } from "./window";

if (process.env.KKNOTE_DATA_DIR)
	app.setPath("userData", process.env.KKNOTE_DATA_DIR);
app.setName("kknote");
let win: BrowserWindow;
let tray: Tray;
let loaded = false;
let quitReady = false;
let quitting = false;
let hiding = false;
let notesPath: string;
const pending = new Map<
	string,
	{ resolve: () => void; reject: (error: Error) => void }
>();

function command(value: AppCommand): void {
	win.webContents.send("app:command", value);
}
function showWindow(): void {
	if (win.isMinimized()) win.restore();
	app.show();
	win.show();
	app.focus({ steal: true });
	win.focus();
	command("focus");
}
function toggleWindow(): void {
	if (win.isVisible() && win.isFocused() && !win.isMinimized()) {
		void hideWindow();
	} else {
		showWindow();
	}
}
async function flush(): Promise<void> {
	if (!loaded || win.isDestroyed()) return;
	const id = crypto.randomUUID();
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => {
			pending.delete(id);
			reject(
				new Error(
					"메모 저장 응답을 기다리는 중입니다. 잠시 후 다시 시도해 주세요.",
				),
			);
		}, 8000);
		pending.set(id, {
			resolve: () => {
				clearTimeout(timer);
				resolve();
			},
			reject: (error) => {
				clearTimeout(timer);
				reject(error);
			},
		});
		win.webContents.send("notes:flush", id);
	});
}
function saveBounds(): void {
	if (win.isDestroyed()) return;
	const path = join(app.getPath("userData"), "window.json");
	writeFileSync(`${path}.tmp`, JSON.stringify(win.getNormalBounds()));
	renameSync(`${path}.tmp`, path);
}
async function hideWindow(): Promise<void> {
	if (hiding) return;
	hiding = true;
	try {
		await flush();
		saveBounds();
		win.hide();
		app.hide();
	} catch (error) {
		await dialog.showMessageBox(win, {
			type: "error",
			message: "저장하지 못했어요",
			detail: String(error),
			buttons: ["메모로 돌아가기"],
		});
	} finally {
		hiding = false;
	}
}
function trusted(
	event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent,
): void {
	if (
		event.sender !== win.webContents ||
		event.senderFrame !== win.webContents.mainFrame
	)
		throw new Error("허용되지 않은 요청입니다.");
}
function setupIPC(): void {
	ipcMain.handle("notes:load", async (event) => {
		trusted(event);
		const book = await loadNotebook(notesPath);
		loaded = true;
		return book;
	});
	ipcMain.handle("notes:save", async (event, book: unknown) => {
		trusted(event);
		if (!loaded)
			throw new Error("메모를 정상적으로 불러온 후에 저장할 수 있습니다.");
		await saveNotebook(notesPath, validateNotebook(book));
	});
	ipcMain.handle("link:open", async (event, url: unknown) => {
		trusted(event);
		if (typeof url !== "string" || !safeExternalUrl(url))
			throw new Error("http, https, mailto 주소만 사용할 수 있습니다.");
		await shell.openExternal(url);
	});
	ipcMain.handle("data:open", async (event) => {
		trusted(event);
		await shell.openPath(app.getPath("userData"));
	});
	ipcMain.on("window:hide", (event) => {
		trusted(event);
		void hideWindow();
	});
	ipcMain.on("notes:flushed", (event, id: string, error: string | null) => {
		trusted(event);
		const request = pending.get(id);
		pending.delete(id);
		if (error) request?.reject(new Error(error));
		else request?.resolve();
	});
}
function setupMenu(): void {
	Menu.setApplicationMenu(
		Menu.buildFromTemplate([
			{
				label: "kknote",
				submenu: [
					{ role: "about" },
					{ type: "separator" },
					{ label: "메모 열기/숨기기", click: toggleWindow },
					{
						label: "저장 폴더 열기",
						click: () => {
							void shell.openPath(app.getPath("userData"));
						},
					},
					{ type: "separator" },
					{ role: "hide" },
					{ role: "hideOthers" },
					{ role: "unhide" },
					{ type: "separator" },
					{ role: "quit" },
				],
			},
			{
				label: "메모",
				submenu: [
					{
						label: "새 메모",
						accelerator: "Command+N",
						click: () => command("new"),
					},
					{
						label: "이전 메모",
						accelerator: "Command+Shift+[",
						click: () => command("previous"),
					},
					{
						label: "다음 메모",
						accelerator: "Command+Shift+]",
						click: () => command("next"),
					},
					{ type: "separator" },
					{ label: "메모 삭제…", click: () => command("delete") },
					{
						label: "창 닫기",
						accelerator: "Command+W",
						click: () => {
							void hideWindow();
						},
					},
				],
			},
			{
				label: "편집",
				submenu: [
					{ role: "undo" },
					{ role: "redo" },
					{ type: "separator" },
					{ role: "cut" },
					{ role: "copy" },
					{ role: "paste" },
					{ role: "selectAll" },
				],
			},
			{
				label: "보기",
				submenu: [
					{ role: "resetZoom" },
					{ role: "zoomIn" },
					{ role: "zoomOut" },
					{ type: "separator" },
					{ role: "togglefullscreen" },
				],
			},
			{
				label: "윈도우",
				submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }],
			},
		]),
	);
	const icon = nativeImage.createFromPath(
		join(__dirname, "../../resources/trayTemplate.png"),
	);
	icon.setTemplateImage(true);
	tray = new Tray(icon);
	tray.setToolTip("kknote · ⌥A");
	tray.setContextMenu(
		Menu.buildFromTemplate([
			{ label: "메모 열기/숨기기  ⌥A", click: toggleWindow },
			{ type: "separator" },
			{ label: "kknote 종료", click: () => app.quit() },
		]),
	);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
	app.on("second-instance", () => {
		if (win) showWindow();
	});
	void app.whenReady().then(() => {
		mkdirSync(app.getPath("userData"), { recursive: true });
		notesPath = join(app.getPath("userData"), "notes.json");
		const workAreas = screen.getAllDisplays().map((d) => d.workArea);
		const primary = screen.getPrimaryDisplay().workArea;
		let bounds: Bounds = {
			x: primary.x + Math.round((primary.width - 700) / 2),
			y: primary.y + Math.round((primary.height - 740) / 2),
			width: 700,
			height: 740,
		};
		try {
			const saved = JSON.parse(
				readFileSync(join(app.getPath("userData"), "window.json"), "utf8"),
			) as Bounds;
			if (
				["x", "y", "width", "height"].every((k) =>
					Number.isFinite(saved[k as keyof Bounds]),
				)
			)
				bounds = saved;
		} catch {}
		bounds = restoreBounds(bounds, workAreas);
		win = new BrowserWindow({
			...bounds,
			minWidth: 380,
			minHeight: 360,
			show: false,
			title: "kknote",
			titleBarStyle: "hidden",
			trafficLightPosition: { x: 22, y: 22 },
			backgroundColor: "#fbfbf8",
			roundedCorners: true,
			webPreferences: {
				preload: join(__dirname, "../preload/index.js"),
				nodeIntegration: false,
				contextIsolation: true,
				sandbox: true,
			},
		});
		setupIPC();
		setupMenu();
		win.webContents.setWindowOpenHandler(({ url }) => {
			if (safeExternalUrl(url)) void shell.openExternal(url);
			return { action: "deny" };
		});
		win.webContents.on("will-navigate", (event) => event.preventDefault());
		win.webContents.session.setPermissionRequestHandler(
			(_contents, _permission, callback) => callback(false),
		);
		win.on("close", (event) => {
			if (!quitReady) {
				event.preventDefault();
				void hideWindow();
			}
		});
		win.once("ready-to-show", () => {
			showWindow();
			if (!globalShortcut.register("Alt+A", toggleWindow)) {
				void dialog.showMessageBox(win, {
					type: "warning",
					message: "⌥A 단축키를 등록하지 못했어요",
					detail:
						"다른 앱에서 같은 단축키를 사용 중인지 확인해 주세요. 메뉴 막대의 kknote 아이콘으로도 열 수 있습니다.",
				});
			}
		});
		if (process.env.ELECTRON_RENDERER_URL)
			void win.loadURL(process.env.ELECTRON_RENDERER_URL);
		else void win.loadFile(join(__dirname, "../renderer/index.html"));
		app.on("activate", showWindow);
	});
	app.on("before-quit", (event) => {
		if (quitReady || !win) return;
		event.preventDefault();
		if (quitting) return;
		quitting = true;
		void flush()
			.then(() => {
				saveBounds();
				quitReady = true;
				app.quit();
			})
			.catch(async (error) => {
				quitting = false;
				showWindow();
				await dialog.showMessageBox(win, {
					type: "error",
					message: "저장하지 못해 종료를 멈췄어요",
					detail: String(error),
					buttons: ["메모로 돌아가기"],
				});
			});
	});
	app.on("will-quit", () => globalShortcut.unregisterAll());
}
