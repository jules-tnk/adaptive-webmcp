export enum SensitiveTargetReason {
  Credential = 'credential',
  Payment = 'payment',
  AuthenticationCode = 'authentication_code',
  File = 'file',
  Hidden = 'hidden',
}

enum SensitiveInputType {
  Password = 'password',
  File = 'file',
  Hidden = 'hidden',
}

enum SensitiveAutocompleteToken {
  CurrentPassword = 'current-password',
  NewPassword = 'new-password',
  OneTimeCode = 'one-time-code',
  CreditCardName = 'cc-name',
  CreditCardNumber = 'cc-number',
  CreditCardExpiration = 'cc-exp',
  CreditCardSecurityCode = 'cc-csc',
}

export interface SensitiveTargetResult {
  readonly blocked: boolean
  readonly reason?: SensitiveTargetReason
}

export class SensitiveTargetPolicy {
  static classify(element: Element): SensitiveTargetResult {
    if (!(element instanceof HTMLInputElement)) {
      return SensitiveTargetPolicy.classifyByContext(element)
    }

    if (element.type === SensitiveInputType.Password) {
      return { blocked: true, reason: SensitiveTargetReason.Credential }
    }
    if (element.type === SensitiveInputType.File) {
      return { blocked: true, reason: SensitiveTargetReason.File }
    }
    if (element.type === SensitiveInputType.Hidden) {
      return { blocked: true, reason: SensitiveTargetReason.Hidden }
    }

    const autocomplete = element.autocomplete.toLowerCase()
    if (
      autocomplete === SensitiveAutocompleteToken.CurrentPassword ||
      autocomplete === SensitiveAutocompleteToken.NewPassword
    ) {
      return { blocked: true, reason: SensitiveTargetReason.Credential }
    }
    if (autocomplete === SensitiveAutocompleteToken.OneTimeCode) {
      return { blocked: true, reason: SensitiveTargetReason.AuthenticationCode }
    }
    if (
      autocomplete === SensitiveAutocompleteToken.CreditCardName ||
      autocomplete === SensitiveAutocompleteToken.CreditCardNumber ||
      autocomplete === SensitiveAutocompleteToken.CreditCardExpiration ||
      autocomplete === SensitiveAutocompleteToken.CreditCardSecurityCode
    ) {
      return { blocked: true, reason: SensitiveTargetReason.Payment }
    }
    return SensitiveTargetPolicy.classifyByContext(element)
  }

  private static classifyByContext(element: Element): SensitiveTargetResult {
    const context = SensitiveTargetPolicy.contextText(element)
    if (/password|passcode|credential/i.test(context)) {
      return { blocked: true, reason: SensitiveTargetReason.Credential }
    }
    if (/card number|credit card|debit card|cvv|cvc|security code/i.test(context)) {
      return { blocked: true, reason: SensitiveTargetReason.Payment }
    }
    if (/one.?time|verification code|authentication code|\botp\b/i.test(context)) {
      return { blocked: true, reason: SensitiveTargetReason.AuthenticationCode }
    }
    return { blocked: false }
  }

  private static contextText(element: Element): string {
    const parts = [
      element.getAttribute('aria-label'),
      element.getAttribute('placeholder'),
      element.getAttribute('name'),
      element.getAttribute('id'),
      element.closest('label')?.textContent,
      element.closest('form')?.getAttribute('aria-label'),
    ]
    if (element instanceof HTMLInputElement) {
      parts.push(element.labels?.[0]?.textContent)
    }
    return parts.filter((part): part is string => Boolean(part)).join(' ')
  }
}
