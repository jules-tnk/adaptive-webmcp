import { Navigate, Route, Routes } from "react-router-dom";
import { Launchpad } from "@/features/launchpad";
import { StudioPage } from "@/features/studio-page";

export function App() {
  return <Routes><Route path="/" element={<Launchpad />} /><Route path="/studio/:projectId" element={<StudioPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
