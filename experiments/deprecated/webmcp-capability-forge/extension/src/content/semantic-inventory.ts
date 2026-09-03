import {
  FailureCode,
  SelectorKind,
  SelectorRanker,
  SemanticRole,
  ValidationIssueCode,
  type PageInspection,
  type SelectorCandidate,
  type SemanticTarget,
  type TargetHandle,
  type ValidationResult,
} from 'webmcp-capability-forge-core'

import { OpenShadowDom } from './open-shadow-dom'
import { SensitiveTargetPolicy } from './sensitive-target-policy'

interface InventoryState {
  readonly revision: number
  readonly elements: ReadonlyMap<string, Element>
}

enum AttributeName {
  AriaHidden = 'aria-hidden',
  AriaLabel = 'aria-label',
  Name = 'name',
  Placeholder = 'placeholder',
}

const maximumTargets = 100
const states = new WeakMap<Document, InventoryState>()

export class SemanticInventory {
  static inspect(documentValue: Document): PageInspection {
    const revision = (states.get(documentValue)?.revision ?? 0) + 1
    const elements = new Map<string, Element>()
    const targets: SemanticTarget[] = []

    for (const element of OpenShadowDom.elements(documentValue)) {
      if (targets.length >= maximumTargets) break
      if (!SemanticInventory.isVisible(element)) continue
      if (SensitiveTargetPolicy.classify(element).blocked) continue

      const id = `target-${targets.length + 1}`
      const handle: TargetHandle = { id, inspectionRevision: revision }
      const role = SemanticInventory.role(element)
      const name = SemanticInventory.name(element)
      const candidates = SelectorRanker.rank(SemanticInventory.candidates(element))
      elements.set(id, element)
      targets.push({
        handle,
        ...(role ? { role } : {}),
        ...(name ? { name } : {}),
        tagName: element.tagName.toLowerCase(),
        strategy: { ...(role ? { role } : {}), ...(name ? { name } : {}), candidates },
      })
    }

    states.set(documentValue, { revision, elements })
    return {
      revision,
      targets,
      truncated: OpenShadowDom.elements(documentValue).length > maximumTargets,
    }
  }

  static resolve(
    documentValue: Document,
    handle: TargetHandle,
  ): ValidationResult<Element> {
    const state = states.get(documentValue)
    if (!state || state.revision !== handle.inspectionRevision) {
      return SemanticInventory.failure(
        FailureCode.StaleRevision,
        ValidationIssueCode.StaleRevision,
        'The target handle belongs to an older page inspection.',
      )
    }
    const element = state.elements.get(handle.id)
    if (!element || !element.isConnected) {
      return SemanticInventory.failure(
        FailureCode.TargetMissing,
        ValidationIssueCode.TargetMissing,
        'The inspected target is no longer connected.',
      )
    }
    return { valid: true, value: element }
  }

  private static failure(
    failure: FailureCode,
    code: ValidationIssueCode,
    message: string,
  ): ValidationResult<never> {
    return { valid: false, failure, issues: [{ path: 'target.handle', code, message }] }
  }

  private static isVisible(element: Element): boolean {
    if (element.hasAttribute('hidden')) return false
    if (element.getAttribute(AttributeName.AriaHidden) === String(true)) return false
    if (element instanceof HTMLInputElement && element.type === 'hidden') return false
    if (element instanceof HTMLElement) {
      if (element.style.display === 'none' || element.style.visibility === 'hidden') return false
    }
    return true
  }

  private static role(element: Element): SemanticRole | undefined {
    const explicit = element.getAttribute('role')
    if (explicit && Object.values(SemanticRole).includes(explicit as SemanticRole)) {
      return explicit as SemanticRole
    }
    if (element instanceof HTMLButtonElement) return SemanticRole.Button
    if (element instanceof HTMLAnchorElement) return SemanticRole.Link
    if (element instanceof HTMLSelectElement) return SemanticRole.Combobox
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox') return SemanticRole.Checkbox
      if (element.type === 'radio') return SemanticRole.Radio
      if (element.type === 'search') return SemanticRole.Searchbox
      return SemanticRole.Textbox
    }
    if (element instanceof HTMLTextAreaElement) return SemanticRole.Textbox
    return undefined
  }

  private static name(element: Element): string | undefined {
    const ariaLabel = element.getAttribute(AttributeName.AriaLabel)?.trim()
    if (ariaLabel) return ariaLabel
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
      const label = element.labels?.[0]?.textContent?.trim()
      if (label) return label
    }
    const text = element.textContent?.trim()
    if (text) return text.slice(0, 256)
    return (
      element.getAttribute(AttributeName.Placeholder)?.trim() ||
      element.getAttribute(AttributeName.Name)?.trim() ||
      undefined
    )
  }

  private static candidates(element: Element): readonly SelectorCandidate[] {
    const root = element.getRootNode()
    const candidates: SelectorCandidate[] = []
    const ariaLabel = element.getAttribute(AttributeName.AriaLabel)
    if (ariaLabel) {
      SemanticInventory.addCandidate(
        root,
        candidates,
        SelectorKind.AccessibleRole,
        `[aria-label="${SemanticInventory.quote(ariaLabel)}"]`,
      )
    }
    if (
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) &&
      element.labels?.length &&
      element.id
    ) {
      const selector = `#${SemanticInventory.quote(element.id)}`
      SemanticInventory.addCandidate(root, candidates, SelectorKind.AssociatedLabel, selector)
    }
    const name = element.getAttribute(AttributeName.Name)
    if (name) {
      SemanticInventory.addCandidate(
        root,
        candidates,
        SelectorKind.StableName,
        `[name="${SemanticInventory.quote(name)}"]`,
      )
    }
    if (element.id) {
      SemanticInventory.addCandidate(
        root,
        candidates,
        SelectorKind.StableId,
        `#${SemanticInventory.quote(element.id)}`,
      )
    }
    const semanticAttribute = Array.from(element.attributes).find((attribute) =>
      attribute.name.startsWith('data-'),
    )
    if (semanticAttribute) {
      const selector = semanticAttribute.value
        ? `[${semanticAttribute.name}="${SemanticInventory.quote(semanticAttribute.value)}"]`
        : `[${semanticAttribute.name}]`
      SemanticInventory.addCandidate(root, candidates, SelectorKind.SemanticAttribute, selector)
    }
    if (candidates.length === 0) {
      SemanticInventory.addCandidate(
        root,
        candidates,
        SelectorKind.Structural,
        SemanticInventory.structuralSelector(element),
      )
    }
    return candidates
  }

  private static addCandidate(
    root: Node,
    candidates: SelectorCandidate[],
    kind: SelectorKind,
    selector: string,
  ): void {
    const queryRoot = root instanceof Document || root instanceof ShadowRoot ? root : document
    let uniqueAtRecording = false
    try {
      uniqueAtRecording = queryRoot.querySelectorAll(selector).length === 1
    } catch {
      uniqueAtRecording = false
    }
    candidates.push({ kind, selector, score: 0, uniqueAtRecording })
  }

  private static quote(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  }

  private static structuralSelector(element: Element): string {
    const parts: string[] = []
    let current: Element | null = element
    while (current) {
      const tag = current.tagName.toLowerCase()
      const parentElement: Element | null = current.parentElement
      if (!parentElement) {
        parts.unshift(tag)
        break
      }
      const siblings: Element[] = Array.from(parentElement.children).filter(
        (candidate: Element) => candidate.tagName === current?.tagName,
      )
      const position = siblings.indexOf(current) + 1
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${position})` : tag)
      if (parentElement.tagName.toLowerCase() === 'body') {
        parts.unshift('body')
        break
      }
      current = parentElement
    }
    return parts.join(' > ')
  }
}
