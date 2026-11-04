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
  const paths = ['/tenant/me', '/tenant/summary', '/tenant/users', '/tenant/drivers', '/tenant/vehicles', '/tenant/trips', '/tenant/profile', '/tenant/audit', '/trips?page=1&pageSize=5', '/drivers?page=1&pageSize=5', '/vehicles?page=1&pageSize=5'];
  for (const p of paths) {
    const res = await fetch(`http://localhost:4000/api/v1${p}`, { headers: { Cookie: cookies } });
    console.log(p, res.status);
  }
}
main();
