import { readdirSync, readFileSync, type Dirent } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const foundationPackages = [
  "circuit-json",
  "format-si-unit",
  "schematic-symbols"
] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry: Dirent) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });
}

function foundationPackageImports(source: string): string[] {
  const importedPackages: string[] = [];
  const sourceFile = ts.createSourceFile(
    "foundation-isolation.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const addFoundationPackage = (packageName: string): void => {
    if (
      packageName.startsWith("@tscircuit/") ||
      foundationPackages.some(
        (foundationPackage) =>
          packageName === foundationPackage || packageName.startsWith(`${foundationPackage}/`)
      )
    ) {
      importedPackages.push(packageName);
    }
  };

  const addStringLiteral = (moduleSpecifier: ts.Expression | undefined): void => {
    if (moduleSpecifier !== undefined && ts.isStringLiteral(moduleSpecifier)) {
      addFoundationPackage(moduleSpecifier.text);
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addStringLiteral(node.moduleSpecifier);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      addStringLiteral(node.arguments.at(0));
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      addFoundationPackage(node.argument.literal.text);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return importedPackages;
}

function foundationImportOffenders(relativePath: string, source: string): string[] {
  return relativePath.startsWith("tscircuit/") ? [] : foundationPackageImports(source);
}

describe("tsCircuit foundation isolation", () => {
  it("detects root and deep foundation imports outside the adapter boundary", () => {
    const imports = foundationImportOffenders("features/circuit.ts", `
      import { resistorProps } from "@tscircuit/props";
      import { capacitorProps } from "@tscircuit/props/lib/components/capacitor";
      export { any_circuit_element } from "circuit-json";
      import "circuit-json/lib/schema";
      import { formatSiUnit } from "format-si-unit";
      import "format-si-unit/lib/index";
      import { symbols } from "schematic-symbols";
      import "schematic-symbols/dist/index";
      await import("@tscircuit/ngspice-spice-engine");
      await import("@tscircuit/props/lib/components/resistor");
      await import("circuit-json");
      await import("circuit-json/lib/schema");
      await import("format-si-unit");
      await import("format-si-unit/lib/index");
      await import("schematic-symbols");
      await import("schematic-symbols/dist/index");
    `);

    expect(imports).toEqual([
      "@tscircuit/props",
      "@tscircuit/props/lib/components/capacitor",
      "circuit-json",
      "circuit-json/lib/schema",
      "format-si-unit",
      "format-si-unit/lib/index",
      "schematic-symbols",
      "schematic-symbols/dist/index",
      "@tscircuit/ngspice-spice-engine",
      "@tscircuit/props/lib/components/resistor",
      "circuit-json",
      "circuit-json/lib/schema",
      "format-si-unit",
      "format-si-unit/lib/index",
      "schematic-symbols",
      "schematic-symbols/dist/index"
    ]);
  });

  it("permits root and deep foundation imports inside src/tscircuit", () => {
    const imports = foundationImportOffenders("tscircuit/adapter.ts", `
      import { resistorProps } from "@tscircuit/props";
      import { capacitorProps } from "@tscircuit/props/lib/components/capacitor";
      import { any_circuit_element } from "circuit-json";
      import "circuit-json/lib/schema";
      await import("@tscircuit/ngspice-spice-engine");
      await import("@tscircuit/props/lib/components/resistor");
      await import("circuit-json");
      await import("circuit-json/lib/schema");
      await import("format-si-unit");
      await import("format-si-unit/lib/index");
      await import("schematic-symbols");
      await import("schematic-symbols/dist/index");
    `);

    expect(imports).toEqual([]);
  });

  it("keeps every foundation package import inside src/tscircuit", () => {
    const sourceRoot = path.resolve(process.cwd(), "src");
    const offenders = sourceFiles(sourceRoot).flatMap((absolutePath) => {
      const relativePath = path.relative(sourceRoot, absolutePath).replaceAll("\\", "/");
      return foundationImportOffenders(relativePath, readFileSync(absolutePath, "utf8"))
        .map((packageName) => `${relativePath} -> ${packageName}`);
    });

    expect(offenders).toEqual([]);
  });
});
