import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const requiredFiles = [
  'listing/en-US.md',
  'privacy/privacy-policy.md',
  'privacy/data-disclosure-matrix.md',
  'privacy/permission-justifications.md',
  'privacy/prominent-disclosure.md',
  'review/test-instructions.md',
  'review/submission-checklist.md',
  'assets/README.md',
]

const publicUrls = [
  'https://webmcp-forge.jules-tnk.com',
  'https://webmcp-forge.jules-tnk.com/privacy',
  'https://webmcp-forge.jules-tnk.com/support',
]

const unfinishedPattern = /\b(?:T[O]DO|T[B]D|FIXM[E])\b|lorem ipsum/i

export class PublicationKitValidator {
  static async validate(deploymentRoot) {
    const issues = []
    const storeRoot = join(deploymentRoot, 'chrome-web-store')
    const files = new Map()

    for (const relativePath of requiredFiles) {
      try {
        files.set(relativePath, await readFile(join(storeRoot, relativePath), 'utf8'))
      } catch {
        issues.push(`Missing publication file: ${relativePath}`)
      }
    }

    const listing = files.get('listing/en-US.md') ?? ''
    const privacy = files.get('privacy/privacy-policy.md') ?? ''
    const matrix = files.get('privacy/data-disclosure-matrix.md') ?? ''
    const permissions = files.get('privacy/permission-justifications.md') ?? ''
    const disclosure = files.get('privacy/prominent-disclosure.md') ?? ''
    const reviewer = files.get('review/test-instructions.md') ?? ''
    const checklist = files.get('review/submission-checklist.md') ?? ''
    const assets = files.get('assets/README.md') ?? ''
    const allContent = [...files.values()].join('\n')

    const shortDescription = listing.match(/^Short description:\s*(.+)$/m)?.[1] ?? ''
    if (shortDescription.length === 0) {
      issues.push('The manifest short description is missing.')
    } else if (shortDescription.length > 132) {
      issues.push('The manifest short description exceeds 132 characters.')
    }

    if (!listing.includes('Name: WebMCP Capability Forge')) {
      issues.push('The listing name is missing or inconsistent.')
    }
    if (!listing.includes('Category: Developer Tools')) {
      issues.push('The Developer Tools category is missing.')
    }
    for (const url of publicUrls) {
      if (!listing.includes(url)) issues.push(`Missing listing URL: ${url}`)
    }

    const permissionContracts = [
      ['scripting', '`scripting`'],
      ['storage', '`storage`'],
      ['tabs', '`tabs`'],
      ['sidePanel', '`sidePanel`'],
      ['optional host access', 'optional HTTP/HTTPS host access'],
    ]
    for (const [name, marker] of permissionContracts) {
      if (!permissions.includes(marker)) {
        issues.push(`Missing permission justification: ${name}`)
      }
    }

    if (!/No remote code/i.test(permissions)) {
      issues.push('The remote-code declaration is missing.')
    }
    if (!/local storage/i.test(privacy)) {
      issues.push('The privacy policy must disclose local storage.')
    }
    if (!/AI agent/i.test(`${privacy}\n${matrix}\n${disclosure}`)) {
      issues.push('The AI-agent disclosure is missing.')
    }
    if (!/Limited Use/i.test(privacy)) {
      issues.push('The Limited Use statement is missing.')
    }
    if (!/developer receives no page data/i.test(matrix)) {
      issues.push('The developer-access disclosure is missing.')
    }

    for (const dimension of ['128x128', '1280x800', '440x280', '1400x560']) {
      if (!assets.includes(dimension)) issues.push(`Missing asset requirement: ${dimension}`)
    }
    if (!reviewer.includes('https://webmcp-forge.jules-tnk.com/lab/guide')) {
      issues.push('The reviewer lab route is missing.')
    }

    for (const gate of [
      'Final manifest reconciliation',
      'Production ZIP',
      'Actual screenshots',
      'Submit for Review',
      'Public release',
    ]) {
      if (!checklist.includes(`- [ ] ${gate}`)) {
        issues.push(`${gate} must remain blocked.`)
      }
    }
    if (unfinishedPattern.test(allContent)) {
      issues.push('The publication kit contains unfinished-work markers.')
    }

    return [...new Set(issues)]
  }

  static async main(argumentsList) {
    const deploymentRoot = resolve(argumentsList[0] ?? '.')
    const issues = await PublicationKitValidator.validate(deploymentRoot)
    if (issues.length > 0) {
      console.error('Publication kit validation failed:')
      issues.forEach((issue) => console.error(`- ${issue}`))
      process.exitCode = 1
      return
    }
    console.log(
      'Publication kit validation passed with deferred package and screenshot gates active.',
    )
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  await PublicationKitValidator.main(process.argv.slice(2))
}
