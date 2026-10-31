// JSON API client. Sends the session's CSRF token (from the page's meta tag)
// with every change, and turns server errors into readable messages. The
// server enforces every permission; this file only carries requests.
const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function request(method, path, body, extraHeaders = {}) {
  const headers = { 'x-csrf-token': csrf(), ...extraHeaders };
  let payload = body;
  if (body !== undefined && !(body instanceof Blob)) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'You appear to be offline. Check your connection and try again.');
  }
  if (res.status === 401) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.hash)}`;
    throw new ApiError(401, 'Please sign in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Something went wrong. Please try again.');
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  patch: (p, b = {}) => request('PATCH', p, b),
  put: (p, b = {}) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
  upload: (p, file, headers = {}) => request('POST', p, file, { 'x-upload-name': file.name, 'content-type': 'text/plain', ...headers }),
};

// Read a form into a plain object: checkboxes become booleans, multiple
// checkboxes with the same name become arrays.
export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') {
      const group = form.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(el.name)}"]`);
      if (group.length > 1) { (out[el.name] ||= []); if (el.checked) out[el.name].push(el.value); } else out[el.name] = el.checked;
    } else if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value; else if (!(el.name in out)) out[el.name] = '';
    } else if (el.type !== 'submit' && el.type !== 'button' && el.type !== 'file') out[el.name] = el.value;
  }
  return out;
}
