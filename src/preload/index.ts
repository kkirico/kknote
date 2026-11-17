import { contextBridge, ipcRenderer } from "electron";
import type { AppCommand, KknoteAPI } from "../shared/api";

const api: KknoteAPI = {
	load: () => ipcRenderer.invoke("notes:load"),
	save: (book) => ipcRenderer.invoke("notes:save", book),
	hide: () => ipcRenderer.send("window:hide"),
	openExternal: (url) => ipcRenderer.invoke("link:open", url),
	openDataFolder: () => ipcRenderer.invoke("data:open"),
	onFlush: (callback) => {
		const listener = (_event: Electron.IpcRendererEvent, id: string) => {
			void callback().then(
				() => ipcRenderer.send("notes:flushed", id, null),
				(error) => ipcRenderer.send("notes:flushed", id, String(error)),
			);
		};
		ipcRenderer.on("notes:flush", listener);
		return () => {
			ipcRenderer.removeListener("notes:flush", listener);
		};
	},
	onCommand: (callback) => {
		const listener = (_event: Electron.IpcRendererEvent, command: AppCommand) =>
			callback(command);
		ipcRenderer.on("app:command", listener);
		return () => {
			ipcRenderer.removeListener("app:command", listener);
		};
	},
};
contextBridge.exposeInMainWorld("kknote", api);
