import { ProjectCodec } from "@/projects/project-codec";
import type { ProjectRecord } from "@/projects/project-types";

export class ProjectFileTransfer {
  static async read(file: File): Promise<string> {
    return file.text();
  }

  static download(record: ProjectRecord, json: string): void {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = ProjectCodec.fileName(record);
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
