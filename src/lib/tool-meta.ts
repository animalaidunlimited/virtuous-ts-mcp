/**
 * Every v0.1 tool is a read. openWorldHint tells the host the call
 * reaches a live system (Virtuous), so it should not assume a closed sandbox.
 */
export const READ_ONLY = {
  readOnlyHint: true,
  openWorldHint: true,
} as const;
