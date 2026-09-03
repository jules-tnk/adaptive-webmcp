enum InteractiveSelector {
  Controls = 'button, a[href], input, select, textarea, [role]',
}

export class OpenShadowDom {
  static elements(root: Document | ShadowRoot): readonly Element[] {
    const elements: Element[] = []
    OpenShadowDom.collect(root, elements)
    return elements
  }

  private static collect(root: Document | ShadowRoot, elements: Element[]): void {
    for (const element of Array.from(root.querySelectorAll(InteractiveSelector.Controls))) {
      elements.push(element)
    }
    for (const element of Array.from(root.querySelectorAll('*'))) {
      if (element.shadowRoot) OpenShadowDom.collect(element.shadowRoot, elements)
    }
  }
}
