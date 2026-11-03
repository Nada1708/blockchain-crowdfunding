import assert from 'node:assert/strict';
import test from 'node:test';
import { authService } from './auth.ts';

test('all authentication requests use relative API paths and include credentials', async () => {
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push([input, init]);
    const body = String(input).endsWith('/nonce') ? { nonce: 'a'.repeat(32) }
      : String(input).endsWith('/session') ? { authenticated: false }
        : String(input).endsWith('/verify') ? { status: 'verified', address: '0x0', chainId: 31337 }
          : { authenticated: false };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await authService.nonce();
    await authService.verify('message', 'signature');
    await authService.session();
    await authService.logout();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(calls.map(([path]) => path), ['/api/auth/nonce', '/api/auth/verify', '/api/auth/session', '/api/auth/logout']);
  assert.ok(calls.every(([, init]) => init?.credentials === 'include'));
});

test('logout forwards the readable CSRF cookie and never places it in the body', async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  let captured: RequestInit | undefined;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'fundora_csrf_dev=test-csrf-token' } });
  globalThis.fetch = async (_input, init) => {
    captured = init;
    return new Response(JSON.stringify({ authenticated: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try { await authService.logout(); }
  finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
  }

  assert.equal((captured?.headers as Record<string, string>)['X-CSRF-Token'], 'test-csrf-token');
  assert.equal(captured?.body, undefined);
});
