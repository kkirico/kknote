import type { Notebook } from "../shared/types";

export type SaveState = "saving" | "saved" | "error";
export class SaveQueue {
	private pending: Notebook | undefined;
	private timer: ReturnType<typeof setTimeout> | undefined;
	private running: Promise<void> | undefined;
	constructor(
		private write: (book: Notebook) => Promise<void>,
		private status: (state: SaveState) => void,
	) {}
	request(book: Notebook): void {
		this.pending = structuredClone(book);
		this.status("saving");
		clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			void this.flush().catch(() => {});
		}, 250);
	}
	flush(): Promise<void> {
		clearTimeout(this.timer);
		if (this.running) return this.running;
		this.running = this.drain().finally(() => {
			this.running = undefined;
		});
		return this.running;
	}
	private async drain(): Promise<void> {
		while (this.pending) {
			const snapshot = this.pending;
			this.pending = undefined;
			try {
				await this.write(snapshot);
			} catch (error) {
				this.pending ??= snapshot;
				this.status("error");
				throw error;
			}
		}
		this.status("saved");
	}
}
