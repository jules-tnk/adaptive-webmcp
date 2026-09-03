(() => {
  try {
    const stored = localStorage.getItem("probepilot:theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = stored === "dark" || (stored !== "light" && prefersDark);
    const mode = dark ? "dark" : "light";
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#090d12" : "#f3f6f8");
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
