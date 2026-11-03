import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmSessionRevocation, revalidateSessionExpiry, sessionMatchesWallet, shouldRevokeForWalletChange, visibleWalletSession } from './auth-state.ts';

const session = {
  authenticated: true as const,
  address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  chainId: 31337,
  idleExpiresAt: '2026-10-26T12:15:00.000Z',
  absoluteExpiresAt: '2026-10-26T13:00:00.000Z',
};

test('session matches the same wallet regardless of address casing', () => {
  assert.equal(sessionMatchesWallet(session, session.address.toLowerCase(), 31337), true);
});

test('account change invalidates the visible authenticated state', () => {
  assert.equal(shouldRevokeForWalletChange(session, true, '0x0000000000000000000000000000000000000001', 31337), true);
});

test('network change invalidates the visible authenticated state', () => {
  assert.equal(shouldRevokeForWalletChange(session, true, session.address, 1), true);
});

test('wallet hydration must finish before evaluating a server session', () => {
  assert.equal(shouldRevokeForWalletChange(session, false, null, null), false);
});

test('restores SIWE access only for the authorized matching MetaMask account', () => {
  assert.equal(visibleWalletSession(session, false, session.address, 31337, false), null);
  assert.equal(visibleWalletSession(session, true, null, 31337, false), null);
  assert.equal(visibleWalletSession(session, true, '0x0000000000000000000000000000000000000001', 31337, false), null);
  assert.equal(visibleWalletSession(session, true, session.address, 1, false), null);
  assert.equal(visibleWalletSession(session, true, session.address, 31337, false), session);
});

test('revocation immediately blocks an otherwise matching wallet session', () => {
  assert.equal(visibleWalletSession(session, true, session.address, 31337, true), null);
});

test('session revocation retries until the server confirms logout', async () => {
  let attempts = 0;
  const result = await confirmSessionRevocation(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('API unavailable');
  }, () => true, 0);

  assert.equal(result, 'confirmed');
  assert.equal(attempts, 3);
});

test('stale revocation work cannot confirm or continue retrying', async () => {
  let current = true;
  let attempts = 0;
  const result = await confirmSessionRevocation(async () => {
    attempts += 1;
    current = false;
    throw new Error('superseded');
  }, () => current, 0);

  assert.equal(result, 'cancelled');
  assert.equal(attempts, 1);
});

test('expiry revalidation refreshes a session returned as valid', async () => {
  const renewed = { ...session, idleExpiresAt: '2026-10-26T12:30:00.000Z' };
  const result = await revalidateSessionExpiry(async () => renewed, () => true);

  assert.deepEqual(result, { status: 'valid', session: renewed });
});

test('expiry is reported only after the server confirms an anonymous session', async () => {
  const result = await revalidateSessionExpiry(async () => ({ authenticated: false }), () => true);

  assert.deepEqual(result, { status: 'expired' });
});

test('network failure at expiry remains a temporary API error', async () => {
  const result = await revalidateSessionExpiry(async () => {
    throw new Error('network unavailable');
  }, () => true);

  assert.deepEqual(result, { status: 'temporary-error' });
});

test('an obsolete expiry response cannot restore or expire a session', async () => {
  let current = true;
  const result = await revalidateSessionExpiry(async () => {
    current = false;
    return session;
  }, () => current);

  assert.deepEqual(result, { status: 'stale' });
});
