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
  const res = await fetch('http://localhost:4000/api/v1/admin/approval-requests/inbox?page=1&pageSize=25', { headers: { Cookie: cookies ?? '' } });
  console.log('status', res.status);
  console.log(await res.text());
}
main();
