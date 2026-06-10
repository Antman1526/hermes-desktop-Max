const NON_ACTIONABLE_UPDATE_ERRORS = [/no published versions on github/i];

export function shouldSuppressUpdateErrorMessage(message: string): boolean {
  return NON_ACTIONABLE_UPDATE_ERRORS.some((pattern) => pattern.test(message));
}
