import type { StoreApi } from "zustand/vanilla";
import type { StudioState } from "@/state/store";
import { createProbePilotTools } from "./tools";

export async function registerProbePilotTools(store: StoreApi<StudioState>): Promise<boolean> {
  const context = document.modelContext;
  const register = context?.registerTool;
  if (!context || typeof register !== "function") {
    store.getState().setWebmcpAvailable(false);
    return false;
  }
  for (const tool of createProbePilotTools(store)) {
    await register.call(context, tool);
  }
  store.getState().setWebmcpAvailable(true);
  return true;
}
