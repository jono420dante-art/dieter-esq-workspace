const BASE = import.meta.env.VITE_API_BASE || '';

async function request(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/api/auth/me'),

  listProjects: () => request('/api/projects'),
  createProject: (data: any) =>
    request('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id: string) => request(`/api/projects/${id}`),
  updateProject: (id: string, data: any) =>
    request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) => request(`/api/projects/${id}`, { method: 'DELETE' }),

  generateTrack: (data: any) =>
    request('/api/generate/track', { method: 'POST', body: JSON.stringify(data) }),
  mutateTrack: (trackId: string) =>
    request('/api/generate/mutate', { method: 'POST', body: JSON.stringify({ track_id: trackId }) }),
  trackStatus: (trackId: string) => request(`/api/generate/status/${trackId}`),

  voices: () => request('/api/voices'),

  exportMix: (data: any) =>
    request('/api/mixer/export', { method: 'POST', body: JSON.stringify(data) }),

  directorSuggest: (data: any) =>
    request('/api/director/suggest', { method: 'POST', body: JSON.stringify(data) }),
};
