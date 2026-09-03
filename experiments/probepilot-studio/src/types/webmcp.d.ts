export {};

declare global {
  type WebMcpJsonValue = string | number | boolean | null | WebMcpJsonObject | readonly WebMcpJsonValue[];
  type WebMcpJsonObject = { readonly [key: string]: WebMcpJsonValue };

  type WebMcpTool = {
    name: string;
    description: string;
    inputSchema: WebMcpJsonObject;
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean };
    execute: (input: WebMcpJsonObject) => object | Promise<object>;
  };

  interface Document {
    modelContext?: {
      registerTool(tool: WebMcpTool): void | Promise<void>;
    };
  }
}
