export type Route =
  | { name: 'dashboard' }
  | { name: 'new' }
  | { name: 'edit'; id: string }
  | { name: 'documents' }
  | { name: 'templates' }
  | { name: 'settings' }
  | { name: 'notfound' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/') return { name: 'dashboard' };
  if (path === '/new') return { name: 'new' };
  if (path === '/documents') return { name: 'documents' };
  if (path === '/templates') return { name: 'templates' };
  if (path === '/settings') return { name: 'settings' };
  const m = /^\/edit\/(.+)$/.exec(path);
  if (m) return { name: 'edit', id: decodeURIComponent(m[1]) };
  return { name: 'notfound' };
}

export function navigate(path: string) {
  window.location.hash = path;
}
