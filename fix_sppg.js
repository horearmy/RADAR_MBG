const fs = require('fs');
let s = fs.readFileSync('src/app/sppg/page.tsx', 'utf8');

const startMarker = `      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>SPPG</strong></div>
        </header>
        <div className="content-area">
          <div className="page">
            <header className="page-hero">

      <section className="kpi-grid kpi-grid-4">`;

const replacement = `      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>SPPG</strong></div>
        </header>
        <div className="content-area">
          <div className="page">
            <header className="page-hero">
              <div className="page-hero-content">
                <p className="page-breadcrumb">Operasional &gt; Manajemen &gt; SPPG</p>
                <div className="page-hero-title-row">
                  <div className="page-hero-icon"><Utensils size={20} /></div>
                  <div>
                    <h1 className="page-title">Manajemen SPPG</h1>
                    <p className="page-subtitle">Kelola profil, lokasi, status operasional, relasi driver & kendaraan, serta aktivitas distribusi setiap unit SPPG.</p>
                  </div>
                </div>
              </div>
              <div className="page-actions">
                <button className="btn btn-ghost" onClick={() => load()} disabled={loading}>
                  <RefreshCw size={16} /> Muat ulang
                </button>
                <Link className="btn btn-primary" href="/sppg/new">
                  <Plus size={16} /> Tambah SPPG
                </Link>
              </div>
            </header>

            <section className="kpi-grid kpi-grid-4">`;

if (s.includes(startMarker)) {
  s = s.replace(startMarker, replacement);
  fs.writeFileSync('src/app/sppg/page.tsx', s);
  console.log('ok');
} else {
  console.log('not found');
}
