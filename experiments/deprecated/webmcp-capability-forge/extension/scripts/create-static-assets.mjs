import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ deviceScaleFactor: 1 })
const page = await context.newPage()

await mkdir(resolve('public', 'icons'), { recursive: true })
await mkdir(resolve('..', 'store-assets'), { recursive: true })

const iconMarkup = `
  <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="16" width="96" height="96" rx="26" fill="#0a0b0d"/>
    <circle cx="45" cy="45" r="11" fill="#0052ff"/>
    <path d="M45 64v19c0 7 5 12 12 12h26" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
    <path d="M67 45h19c7 0 12 5 12 12v26" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
  </svg>`

for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;width:${size}px;height:${size}px;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${iconMarkup}`)
  await page.screenshot({ path: resolve('public', 'icons', `icon-${size}.png`), omitBackground: true })
}

await page.setViewportSize({ width: 440, height: 280 })
await page.setContent(`
  <style>
    *{box-sizing:border-box}body{margin:0;width:440px;height:280px;padding:32px;background:#0a0b0d;color:#fff;font-family:Arial,sans-serif;overflow:hidden}
    .top{display:flex;align-items:center;gap:12px;font-size:13px;font-weight:700}.dot{width:12px;height:12px;border-radius:50%;background:#0052ff}
    h1{width:350px;margin:45px 0 18px;font-size:42px;line-height:.96;letter-spacing:-2px;font-weight:500}
    p{margin:0;color:#b8bbc2;font-size:15px}.line{position:absolute;right:0;bottom:34px;width:150px;height:2px;background:#0052ff}
  </style>
  <div class="top"><span class="dot"></span>WebMCP Capability Forge</div>
  <h1>Teach browser work. Reuse it with an agent.</h1>
  <p>Human-reviewed WebMCP workflows.</p><span class="line"></span>`)
await page.screenshot({ path: resolve('..', 'store-assets', 'promo-440x280.png') })

await browser.close()
