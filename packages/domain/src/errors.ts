/** Business-rule violation. `field` lets the UI attach the message to the right input. */
export class DomainError extends Error {
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'DomainError'
    this.field = field
  }
}
