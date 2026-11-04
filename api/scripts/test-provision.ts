import * as OTPAuth from 'otpauth';
async function main() {
  const secret = 'OUKJAIUXDHRHCQVADWEH3BBG6VA5ISII';
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) });
  const code = totp.generate();
  const csrfRes = await fetch('http://localhost:4000/api/v1/auth/csrf', { credentials: 'include' });
  const csrfJson = await csrfRes.json();
  const csrfCookie = csrfRes.headers.get('set-cookie');
  const loginRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', 'X-CSRF-Token': csrfJson.csrfToken, Cookie: csrfCookie ?? '' },
    body: JSON.stringify({ username: 'admin', password: 'LzmtZSmeuBBEtZEhqoEYVPYK', otpCode: code }),
  });
  const cookies = loginRes.headers.get('set-cookie');
  const allCookies = [csrfCookie, cookies].filter(Boolean).join('; ');
  const listRes = await fetch('http://localhost:4000/api/v1/public/sppg-registrations', { headers: { Cookie: allCookies } });
  const list = await listRes.json();
  const approved = list.find((r: any) => r.status === 'APPROVED');
  console.log('approved reg:', approved?.id);
  if (!approved) return;
  const provRes = await fetch(`http://localhost:4000/api/v1/public/sppg-registrations/${approved.id}/provision`, {
    method: 'POST', headers: { Cookie: allCookies, 'X-CSRF-Token': csrfJson.csrfToken, Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
  });
  console.log('provision status', provRes.status);
  console.log(await provRes.text());
}
main();
