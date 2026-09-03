import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/app/app";
import { studioStore } from "@/state/store";
import { registerProbePilotTools } from "@/webmcp/register";
import { projectAutosave } from "@/projects/project-runtime";
import "@/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("ProbePilot root element not found.");

ReactDOM.createRoot(root).render(<React.StrictMode><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></BrowserRouter></React.StrictMode>);

void registerProbePilotTools(studioStore);
projectAutosave.start();
