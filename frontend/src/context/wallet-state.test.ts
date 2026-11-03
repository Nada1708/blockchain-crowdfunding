import assert from 'node:assert/strict';
import test from 'node:test';
import { isWalletPermissionUnsupported } from './wallet-state.ts';

test('recognizes providers without wallet_requestPermissions support', () => {
  assert.equal(isWalletPermissionUnsupported({ code: -32601 }), true);
  assert.equal(isWalletPermissionUnsupported({ code: 4200 }), true);
  assert.equal(isWalletPermissionUnsupported({ code: 'UNSUPPORTED_OPERATION' }), true);
  assert.equal(isWalletPermissionUnsupported({ code: 4001 }), false);
});
