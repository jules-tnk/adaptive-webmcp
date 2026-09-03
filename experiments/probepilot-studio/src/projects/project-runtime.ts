import { ProjectAutosave } from "@/projects/project-autosave";
import { ProjectRepository } from "@/projects/project-repository";
import { studioStore } from "@/state/store";

export const projectRepository = new ProjectRepository(window.localStorage);
export const projectAutosave = new ProjectAutosave(projectRepository, studioStore);
