import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
};

export function setup() {
  const csrfRes = http.get('http://localhost:4000/api/v1/auth/csrf');
  const csrfJson = csrfRes.json();
  const csrfCookie = csrfRes.headers['Set-Cookie'];
  const loginRes = http.post('http://localhost:4000/api/v1/auth/login', JSON.stringify({
    username: 'tenantadmin',
    password: 'TenantPass123!',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfJson.csrfToken,
      Cookie: csrfCookie,
    },
  });
  const cookies = loginRes.headers['Set-Cookie'];
  return { cookies };
}

export default function (data) {
  const res = http.get('http://localhost:4000/api/v1/tenant/me', {
    headers: { Cookie: data.cookies },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
}
