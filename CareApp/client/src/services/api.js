const browserApiBase = () => {
  if (typeof window === 'undefined') return 'http://localhost:4000/api';
  const hostname = window.location.hostname.includes(':') ? `[${window.location.hostname}]` : window.location.hostname;
  return `${window.location.protocol}//${hostname}:4000/api`;
};

export const API_BASE = import.meta.env.VITE_API_URL || browserApiBase();
const TOKEN_KEY = 'careapp.token';
const USER_KEY = 'careapp.user';

export const authStore = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser: () => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  set: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

export async function api(path, options = {}) {
  const token = authStore.getToken();
  const headers = new Headers(options.headers || {});

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Request failed.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return response.blob();
}

export async function login(path, body) {
  const payload = await api(path, { method: 'POST', body });
  authStore.set(payload.token, payload.user);
  return payload.user;
}

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    authStore.clear();
  }
}

export async function openFile(fileId, mode = 'view') {
  const blob = await api(`/files/${fileId}/${mode}`);
  const url = URL.createObjectURL(blob);

  if (mode === 'download') {
    const link = document.createElement('a');
    link.href = url;
    link.download = 'care-study.pdf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return null;
  }

  return url;
}

export async function exportExcel(path, fileName) {
  const blob = await api(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
