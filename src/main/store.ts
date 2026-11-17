import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createNotebook, validateNotebook } from "../shared/notebook";
import type { Notebook } from "../shared/types";

const queues = new Map<string, Promise<void>>();
export async function loadNotebook(path: string): Promise<Notebook> {
	try {
		return validateNotebook(JSON.parse(await readFile(path, "utf8")));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			return createNotebook();
		throw error;
	}
}
export function saveNotebook(path: string, notebook: Notebook): Promise<void> {
	const json = JSON.stringify(validateNotebook(notebook));
	const next = (queues.get(path) ?? Promise.resolve())
		.catch(() => {})
		.then(async () => {
			const temporary = `${path}.${crypto.randomUUID()}.tmp`;
			try {
				await writeFile(temporary, json, { mode: 0o600, flush: true });
				await rename(temporary, path);
			} catch (error) {
				await unlink(temporary).catch(() => {});
				throw error;
			}
		});
	queues.set(path, next);
	return next;
}
