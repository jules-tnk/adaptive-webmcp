export enum SelectorKind {
  AccessibleRole = 'accessible_role',
  AssociatedLabel = 'associated_label',
  StableName = 'stable_name',
  StableId = 'stable_id',
  SemanticAttribute = 'semantic_attribute',
  Structural = 'structural',
}

export enum SemanticRole {
  Button = 'button',
  Checkbox = 'checkbox',
  Combobox = 'combobox',
  Link = 'link',
  Option = 'option',
  Radio = 'radio',
  Searchbox = 'searchbox',
  Textbox = 'textbox',
}

export interface SelectorCandidate {
  readonly kind: SelectorKind
  readonly selector: string
  readonly score: number
  readonly uniqueAtRecording: boolean
}

export interface TargetStrategy {
  readonly role?: SemanticRole
  readonly name?: string
  readonly candidates: readonly SelectorCandidate[]
}

export interface TargetHandle {
  readonly id: string
  readonly inspectionRevision: number
}

export interface SemanticTarget {
  readonly handle: TargetHandle
  readonly role?: SemanticRole
  readonly name?: string
  readonly tagName: string
  readonly strategy: TargetStrategy
}

export interface PageInspection {
  readonly revision: number
  readonly targets: readonly SemanticTarget[]
  readonly truncated: boolean
}
