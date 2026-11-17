import type { Bounds } from "../shared/types";

export function safeExternalUrl(value: string): boolean {
	try {
		return ["https:", "http:", "mailto:"].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}
export function restoreBounds(saved: Bounds, screens: Bounds[]): Bounds {
	const display =
		screens.find(
			(s) =>
				saved.x >= s.x &&
				saved.y >= s.y &&
				saved.x + saved.width <= s.x + s.width &&
				saved.y + saved.height <= s.y + s.height,
		) ?? screens[0];
	const width = Math.min(Math.max(saved.width, 380), display.width);
	const height = Math.min(Math.max(saved.height, 360), display.height);
	return {
		width,
		height,
		x: Math.max(
			display.x,
			Math.min(saved.x, display.x + display.width - width),
		),
		y: Math.max(
			display.y,
			Math.min(saved.y, display.y + display.height - height),
		),
	};
}
