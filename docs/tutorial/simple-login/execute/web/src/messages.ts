// User-facing copy fixed by the PRD and the node's D3 (one message per failure).
export const MESSAGES = {
  /** AC-1.2: never says which of the two was wrong. */
  invalidCredentials: 'Incorrect username or password.',
  /** D3: a network failure or an unexpected answer. */
  unavailable: 'Could not reach the server. Please try again.',
} as const
