export enum ThemeMode {
  Light = "light",
  Dark = "dark"
}

enum ThemeStorage {
  Key = "probepilot:theme"
}

const themeColors: Readonly<Record<ThemeMode, string>> = {
  [ThemeMode.Light]: "#f3f6f8",
  [ThemeMode.Dark]: "#090d12"
};

export class ThemeController {
  static resolve(stored: string | null, prefersDark: boolean): ThemeMode {
    if (stored === ThemeMode.Light) return ThemeMode.Light;
    if (stored === ThemeMode.Dark) return ThemeMode.Dark;
    return prefersDark ? ThemeMode.Dark : ThemeMode.Light;
  }

  static current(documentValue: Document): ThemeMode {
    return documentValue.documentElement.classList.contains(ThemeMode.Dark)
      ? ThemeMode.Dark
      : ThemeMode.Light;
  }

  static apply(mode: ThemeMode, documentValue: Document, storage: Storage): void {
    documentValue.documentElement.classList.toggle(ThemeMode.Dark, mode === ThemeMode.Dark);
    documentValue.documentElement.dataset.theme = mode;
    const themeColor = documentValue.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute("content", themeColors[mode]);
    try {
      storage.setItem(ThemeStorage.Key, mode);
    } catch {
      // Theme switching remains functional when browser storage is unavailable.
    }
  }

  static toggle(mode: ThemeMode): ThemeMode {
    return mode === ThemeMode.Dark ? ThemeMode.Light : ThemeMode.Dark;
  }
}
