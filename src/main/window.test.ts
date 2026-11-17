import { describe, expect, it } from "vitest";
import { restoreBounds, safeExternalUrl } from "./window";

describe("창과 링크 경계", () => {
	it("안전한 외부 주소만 허용한다", () => {
		expect(safeExternalUrl("https://example.com/path")).toBe(true);
		expect(safeExternalUrl("mailto:test@example.com")).toBe(true);
		for (const value of [
			"javascript:alert(1)",
			"file:///etc/passwd",
			"data:text/html,x",
			"not a url",
		]) {
			expect(safeExternalUrl(value)).toBe(false);
		}
	});
	it("분리된 모니터의 창을 현재 화면 안으로 복원한다", () => {
		const bounds = restoreBounds({ x: 2800, y: 100, width: 780, height: 720 }, [
			{ x: 0, y: 25, width: 1440, height: 875 },
		]);
		expect(bounds.x).toBeGreaterThanOrEqual(0);
		expect(bounds.y).toBeGreaterThanOrEqual(25);
		expect(bounds.x + bounds.width).toBeLessThanOrEqual(1440);
		expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
	});
	it("현재 화면 안의 크기와 위치는 유지한다", () => {
		expect(
			restoreBounds({ x: 100, y: 100, width: 620, height: 700 }, [
				{ x: 0, y: 25, width: 1440, height: 875 },
			]),
		).toEqual({ x: 100, y: 100, width: 620, height: 700 });
	});
});
