async function main() {
  const csrfRes = await fetch('http://localhost:4000/api/v1/auth/csrf', { credentials: 'include' });
  const csrfJson = await csrfRes.json();
  const csrfCookie = csrfRes.headers.get('set-cookie');
  const loginRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', 'X-CSRF-Token': csrfJson.csrfToken, Cookie: csrfCookie ?? '' },
    body: JSON.stringify({ username: 'tenantadmin', password: 'TenantPass123!' }),
  });
  const cookies = [csrfCookie, loginRes.headers.get('set-cookie')].filter(Boolean).join('; ');
  const meRes = await fetch('http://localhost:4000/api/v1/auth/me', { headers: { Cookie: cookies } });
  const me = await meRes.json();
  console.log('tenantRole:', me.user?.tenantRole);
  console.log('roles:', me.user?.roles);
}
main();
