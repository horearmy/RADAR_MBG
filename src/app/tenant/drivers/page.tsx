'use client';
import { FormEvent, useEffect, useState } from 'react';
const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? 'http://localhost:4000/api/v1';

export default function TenantDriversPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ code: '', name: '', phone: '' });
  const [msg, setMsg] = useState('');

  async function load() {
    const data = await fetch(`${apiBase}/tenant/drivers`, { credentials: 'include' }).then((r) => r.json());
    setRows(Array.isArray(data) ? data : []);
  }
  useEffect(() => { void load(); }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const csrf = await fetch(`${apiBase}/auth/csrf`, { credentials: 'include' }).then((r) => r.json());
    const res = await fetch(`${apiBase}/tenant/drivers`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
      body: JSON.stringify(form),
    });
    setMsg(res.ok ? 'Driver ditambahkan.' : 'Gagal menambahkan driver.');
    if (res.ok) { setForm({ code: '', name: '', phone: '' }); await load(); }
  }

  return (
    <>
      <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />MANAJEMEN</div><h1>Driver</h1><p>Kelola pengemudi milik SPPG ini.</p></div></div>
      <div className="bottom-grid">
        <section className="panel">
          <div className="panel-heading"><h2>Daftar driver</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>KODE</th><th>NAMA</th><th>TELEPON</th><th>STATUS</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.id}><td>{r.code}</td><td>{r.name}</td><td>{r.phone ?? '-'}</td><td><span className="status-pill">{r.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <form className="panel" onSubmit={create} style={{ padding: 16, display: 'grid', gap: 8 }}>
          <h2>Tambah driver</h2>
          <input className="date-button" placeholder="Kode" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="date-button" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="date-button" placeholder="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <button className="export-button" type="submit">Simpan driver</button>
          {msg && <p>{msg}</p>}
        </form>
      </div>
    </>
  );
}
