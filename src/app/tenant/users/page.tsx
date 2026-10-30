'use client';
import { FormEvent, useEffect, useState } from 'react';
const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? 'http://localhost:4000/api/v1';

export default function TenantUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [invite, setInvite] = useState({ username: '', displayName: '', role: 'TENANT_OPERATOR' });
  const [token, setToken] = useState('');
  async function load() {
    const data = await fetch(`${apiBase}/tenant/users`, { credentials: 'include' }).then((r) => r.json());
    setUsers(Array.isArray(data) ? data : []);
  }
  useEffect(() => { void load(); }, []);
  async function send(e: FormEvent) {
    e.preventDefault();
    const csrf = await fetch(`${apiBase}/auth/csrf`, { credentials: 'include' }).then((r) => r.json());
    const res = await fetch(`${apiBase}/tenant/invitations`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
      body: JSON.stringify(invite),
    });
    const body = await res.json();
    setToken(body.invitationToken ?? '');
    await load();
  }
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />AKSES</div><h1>Pengguna</h1><p>Undang operator atau driver untuk workspace ini.</p></div></div>
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="table-wrap"><table><thead><tr><th>NAMA</th><th>USERNAME</th><th>ROLE</th><th>STATUS</th></tr></thead>
          <tbody>{users.map((u) => <tr key={u.id}><td>{u.user?.displayName}</td><td>{u.user?.username}</td><td>{u.role}</td><td>{u.status}</td></tr>)}</tbody></table></div>
      </section>
      <form className="panel" onSubmit={send} style={{ padding: 16, display: 'grid', gap: 8, maxWidth: 480 }}>
        <input className="date-button" placeholder="Username" value={invite.username} onChange={(e) => setInvite({ ...invite, username: e.target.value })} required />
        <input className="date-button" placeholder="Nama" value={invite.displayName} onChange={(e) => setInvite({ ...invite, displayName: e.target.value })} required />
        <select className="date-button" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
          <option value="TENANT_OPERATOR">Operator</option><option value="TENANT_DRIVER">Driver</option><option value="TENANT_VIEWER">Viewer</option>
        </select>
        <button className="export-button" type="submit">Undang</button>
        {token && <p>Token undangan: {token}</p>}
      </form>
    </>
  );
}
