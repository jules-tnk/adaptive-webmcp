import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "lib": path.resolve(__dirname, "./node_modules/@tscircuit/props/lib"),
      "module": path.resolve(__dirname, "./src/tscircuit/browser-node-module-shim.ts")
    }
  },
  build: {
    chunkSizeWarningLimit: 7500,
    rollupOptions: {
      output: {
        manualChunks(moduleId) {
          const normalizedId = moduleId.replaceAll("\\", "/");
          if (normalizedId.includes("/node_modules/circuit-json-to-spice/")) return "spice-converter";
          if (normalizedId.includes("/node_modules/spicets/")) return "spice-netlist";
          if (normalizedId.includes("/node_modules/@tscircuit/props/")) return "tscircuit-props";
          if (normalizedId.includes("/node_modules/schematic-symbols/")) return "tscircuit-symbols";
          if (normalizedId.includes("/node_modules/circuit-json/") || normalizedId.includes("/node_modules/format-si-unit/")) return "tscircuit-data";
          if (normalizedId.includes("/node_modules/zod/")) return "validation";
          if (normalizedId.includes("/node_modules/react/") || normalizedId.includes("/node_modules/react-dom/") || normalizedId.includes("/node_modules/react-router")) return "react-vendor";
          return undefined;
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"]
  }
});
