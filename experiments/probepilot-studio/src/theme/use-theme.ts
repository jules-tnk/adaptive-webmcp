import { useState } from "react";
import { ThemeController, ThemeMode } from "@/theme/theme";

export interface ThemeState {
  readonly mode: ThemeMode;
  readonly toggle: () => void;
}

export function useTheme(): ThemeState {
  const [mode, setMode] = useState<ThemeMode>(() => ThemeController.current(document));

  const toggle = (): void => {
    const nextMode = ThemeController.toggle(mode);
    ThemeController.apply(nextMode, document, window.localStorage);
    setMode(nextMode);
  };

  return { mode, toggle };
}
