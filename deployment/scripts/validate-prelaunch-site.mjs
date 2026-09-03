import { readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pageContracts = [
  {
    file: 'index.html',
    canonical: 'https://webmcp-forge.jules-tnk.com/',
  },
  {
    file: join('privacy', 'index.html'),
    canonical: 'https://webmcp-forge.jules-tnk.com/privacy',
  },
  {
    file: join('support', 'index.html'),
    canonical: 'https://webmcp-forge.jules-tnk.com/support',
  },
]

const unfinishedPattern = /\b(?:T[O]DO|T[B]D|FIXM[E])\b/i
const trackingPattern =
  /googletagmanager|google-analytics|facebook\.net\/(?:en_US\/)?fbevents|connect\.facebook\.net/i

export class PrelaunchSiteValidator {
  static async validate(rootDirectory) {
    const issues = []
    const pages = new Map()

    for (const contract of pageContracts) {
      try {
        const content = await readFile(join(rootDirectory, contract.file), 'utf8')
        pages.set(contract.file, content)
        if (!content.includes(`rel="canonical" href="${contract.canonical}"`)) {
          issues.push(`Missing canonical URL: ${contract.canonical}`)
        }
      } catch {
        issues.push(`Missing required page: ${contract.file}`)
      }
    }

    const home = pages.get('index.html') ?? ''
    const privacy = pages.get(join('privacy', 'index.html')) ?? ''
    const allContent = [...pages.values()].join('\n')

    if (!/WebMCP Capability Forge is in development\./i.test(home)) {
      issues.push('The homepage must state that the extension is in development.')
    }
    if (!home.includes('href="/privacy"') || !home.includes('href="/support"')) {
      issues.push('The homepage must link to Privacy and Support.')
    }
    if (!/Limited Use/i.test(privacy)) {
      issues.push('The privacy page must mention Limited Use.')
    }
    if (/<script\b/i.test(allContent)) {
      issues.push('Static pages must not contain scripts.')
    }
    if (/<form\b/i.test(allContent)) {
      issues.push('Static pages must not contain forms.')
    }
    if (trackingPattern.test(allContent)) {
      issues.push('Static pages must not contain tracking services.')
    }
    if (/<iframe\b|document\.cookie|cookie[_ -]?consent/i.test(allContent)) {
      issues.push('Static pages must not contain embeds or cookie mechanisms.')
    }
    if (unfinishedPattern.test(allContent) || /lorem ipsum/i.test(allContent)) {
      issues.push('Static pages must not contain unfinished-work markers.')
    }
    if (/Install now from the Chrome Web Store/i.test(home)) {
      issues.push('The homepage must state that the extension is in development.')
    }

    return [...new Set(issues)]
  }

  static async main(argumentsList) {
    const rootDirectory = resolve(argumentsList[0] ?? '')
    const issues = await PrelaunchSiteValidator.validate(rootDirectory)
    if (issues.length > 0) {
      console.error(`Prelaunch site validation failed for ${basename(rootDirectory)}:`)
      issues.forEach((issue) => console.error(`- ${issue}`))
      process.exitCode = 1
      return
    }
    console.log('Prelaunch site validation passed.')
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  await PrelaunchSiteValidator.main(process.argv.slice(2))
}
