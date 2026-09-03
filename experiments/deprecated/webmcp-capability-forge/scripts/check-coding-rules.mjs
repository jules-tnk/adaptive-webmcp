import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import ts from 'typescript'

const sourceRoots = ['packages/core/src', 'extension/src', 'website/src']

export class CodingRuleChecker {
  static checkText(fileName, source) {
    const sourceFile = ts.createSourceFile(
      fileName,
      source,
      ts.ScriptTarget.Latest,
      true,
      fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    const issues = []
    let exportedStandaloneFunctions = 0

    const visit = (node) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        issues.push(CodingRuleChecker.issue('ExplicitAny', fileName, sourceFile, node))
      }
      if (node.kind === ts.SyntaxKind.UnknownKeyword) {
        issues.push(CodingRuleChecker.issue('ExplicitUnknown', fileName, sourceFile, node))
      }
      if (
        ts.isUnionTypeNode(node) &&
        node.types.filter((member) => ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal))
          .length > 1
      ) {
        issues.push(CodingRuleChecker.issue('StringLiteralUnion', fileName, sourceFile, node))
      }
      ts.forEachChild(node, visit)
    }

    for (const statement of sourceFile.statements) {
      if (!CodingRuleChecker.isExported(statement)) continue
      if (ts.isFunctionDeclaration(statement)) exportedStandaloneFunctions += 1
      if (ts.isVariableStatement(statement)) {
        exportedStandaloneFunctions += statement.declarationList.declarations.filter(
          (declaration) =>
            declaration.initializer !== undefined &&
            (ts.isArrowFunction(declaration.initializer) ||
              ts.isFunctionExpression(declaration.initializer)),
        ).length
      }
    }

    visit(sourceFile)
    if (exportedStandaloneFunctions > 1) {
      issues.push({
        code: 'MultipleStandaloneFunctionExports',
        fileName,
        line: 1,
        column: 1,
      })
    }
    return issues
  }

  static async checkWorkspace(workspaceRoot) {
    const files = []
    for (const sourceRoot of sourceRoots) {
      await CodingRuleChecker.collectFiles(path.join(workspaceRoot, sourceRoot), files)
    }
    const issues = []
    for (const fileName of files.sort()) {
      const source = await readFile(fileName, 'utf8')
      issues.push(...CodingRuleChecker.checkText(path.relative(workspaceRoot, fileName), source))
    }
    return issues
  }

  static issue(code, fileName, sourceFile, node) {
    const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    return {
      code,
      fileName,
      line: location.line + 1,
      column: location.character + 1,
    }
  }

  static isExported(node) {
    return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true
  }

  static async collectFiles(directory, files) {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await CodingRuleChecker.collectFiles(entryPath, files)
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.endsWith('.d.ts')
      ) {
        files.push(entryPath)
      }
    }
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const workspaceRoot = process.cwd()
  const issues = await CodingRuleChecker.checkWorkspace(workspaceRoot)
  if (issues.length > 0) {
    for (const issue of issues) {
      process.stderr.write(
        `${issue.fileName}:${issue.line}:${issue.column} ${issue.code}\n`,
      )
    }
    process.exitCode = 1
  }
}
