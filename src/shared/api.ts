import type { Notebook } from "./types";

export type AppCommand = "new" | "previous" | "next" | "delete" | "focus";
export interface KknoteAPI {
	load(): Promise<Notebook>;
	save(book: Notebook): Promise<void>;
	hide(): void;
	openExternal(url: string): Promise<void>;
	openDataFolder(): Promise<void>;
	onFlush(callback: () => Promise<void>): () => void;
	onCommand(callback: (command: AppCommand) => void): () => void;
}
declare global {
	interface Window {
		kknote: KknoteAPI;
	}
}
