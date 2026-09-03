import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeMode } from "@/theme/theme";
import { useTheme } from "@/theme/use-theme";

export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const isDark = mode === ThemeMode.Dark;
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={toggle}>
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
