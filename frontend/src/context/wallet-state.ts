export function isWalletPermissionUnsupported(error: unknown) {
  const code = (error as { code?: number | string }).code;
  return code === -32601 || code === 4200 || code === 'UNSUPPORTED_OPERATION';
}
