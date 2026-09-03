import type { BoundedObservation } from 'webmcp-capability-forge-core'

const maximumObservationBytes = 32 * 1024

export class PageObserver {
  static capture(root: Element): BoundedObservation {
    const source = root.textContent?.replaceAll(/\s+/g, ' ').trim() ?? ''
    const encoder = new TextEncoder()
    if (encoder.encode(source).byteLength <= maximumObservationBytes) {
      return { text: source, truncated: false }
    }
    let end = Math.min(source.length, maximumObservationBytes)
    while (end > 0 && encoder.encode(source.slice(0, end)).byteLength > maximumObservationBytes) {
      end -= 1
    }
    return { text: source.slice(0, end), truncated: true }
  }
}
