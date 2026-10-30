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
  const cookies = [csrfCookie, loginRes.headers.get('set-cookie')].filter(Boolean).join('; ');
  const id = '28778666-693d-4b8d-8e4a-3e88c75cfa47';
  const provRes = await fetch(`http://localhost:4000/api/v1/public/sppg-registrations/${id}/provision`, {
    method: 'POST', headers: { Cookie: cookies, 'X-CSRF-Token': csrfJson.csrfToken, Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
  });
  console.log('provision status', provRes.status);
  console.log(await provRes.text());
}
main();
