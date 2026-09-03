import { beforeEach, describe, expect, it } from "vitest";
import { ThemeController, ThemeMode } from "@/theme/theme";

describe("ThemeController", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.head.innerHTML = '<meta name="theme-color" content="#000000">';
  });

  it("uses a stored mode before the system preference", () => {
    expect(ThemeController.resolve(ThemeMode.Light, true)).toBe(ThemeMode.Light);
    expect(ThemeController.resolve(ThemeMode.Dark, false)).toBe(ThemeMode.Dark);
  });

  it("uses the system preference when no mode was stored", () => {
    expect(ThemeController.resolve(null, true)).toBe(ThemeMode.Dark);
    expect(ThemeController.resolve(null, false)).toBe(ThemeMode.Light);
  });

  it("applies and persists the selected mode", () => {
    ThemeController.apply(ThemeMode.Light, document, localStorage);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.dataset.theme).toBe(ThemeMode.Light);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#f3f6f8");
    expect(localStorage.getItem("probepilot:theme")).toBe(ThemeMode.Light);

    ThemeController.apply(ThemeMode.Dark, document, localStorage);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(ThemeController.toggle(ThemeMode.Dark)).toBe(ThemeMode.Light);
  });
});
