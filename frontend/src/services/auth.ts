export type AuthSession = {
  authenticated: true;
  address: string;
  chainId: number;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
};

export type AnonymousSession = { authenticated: false };
export type SessionResponse = AuthSession | AnonymousSession;

export class AuthApiError extends Error {
  readonly status: number;

  constructor(status: number, message = 'Authentication request failed.') {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'include' });
  if (!response.ok) throw new AuthApiError(response.status);
  return response.json() as Promise<T>;
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [cookieName, ...value] = part.trim().split('=');
    if (cookieName === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

function csrfToken() {
  return getCookie('__Host-fundora_csrf') ?? getCookie('fundora_csrf_dev');
}

export const authService = {
  nonce: () => request<{ nonce: string }>('/api/auth/nonce'),
  verify: (message: string, signature: string) => request<{ status: 'verified'; address: string; chainId: number }>('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  }),
  session: () => request<SessionResponse>('/api/auth/session'),
  logout: () => {
    const token = csrfToken();
    return request<AnonymousSession>('/api/auth/logout', {
      method: 'POST',
      headers: token ? { 'X-CSRF-Token': token } : undefined,
    });
  },
};
