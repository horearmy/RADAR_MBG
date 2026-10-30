'use client';
import { FormEvent, useEffect, useState } from 'react';
const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? 'http://localhost:4000/api/v1';

export default function TenantVehiclesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ plateNumber: '', label: '', capacity: '' });
  const [msg, setMsg] = useState('');

  async function load() {
    const data = await fetch(`${apiBase}/tenant/vehicles`, { credentials: 'include' }).then((r) => r.json());
    setRows(Array.isArray(data) ? data : []);
  }
  useEffect(() => { void load(); }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const csrf = await fetch(`${apiBase}/auth/csrf`, { credentials: 'include' }).then((r) => r.json());
    const res = await fetch(`${apiBase}/tenant/vehicles`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
      body: JSON.stringify({ plateNumber: form.plateNumber, label: form.label, capacity: form.capacity ? Number(form.capacity) : undefined }),
    });
    setMsg(res.ok ? 'Kendaraan ditambahkan.' : 'Gagal menambahkan kendaraan.');
    if (res.ok) { setForm({ plateNumber: '', label: '', capacity: '' }); await load(); }
  }

  return (
    <>
      <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />MANAJEMEN</div><h1>Kendaraan</h1><p>Kelola armada milik SPPG ini.</p></div></div>
      <div className="bottom-grid">
        <section className="panel">
          <div className="panel-heading"><h2>Daftar kendaraan</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>NOPOL</th><th>LABEL</th><th>KAPASITAS</th><th>STATUS</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.id}><td>{r.plateNumber}</td><td>{r.label ?? '-'}</td><td>{r.capacity ?? '-'}</td><td><span className="status-pill">{r.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <form className="panel" onSubmit={create} style={{ padding: 16, display: 'grid', gap: 8 }}>
          <h2>Tambah kendaraan</h2>
          <input className="date-button" placeholder="Nomor polisi" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} required />
          <input className="date-button" placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <input className="date-button" placeholder="Kapasitas" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <button className="export-button" type="submit">Simpan kendaraan</button>
          {msg && <p>{msg}</p>}
        </form>
      </div>
    </>
  );
}
