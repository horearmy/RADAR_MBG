"use client";

import Link from "next/link";
import { Package, Truck, UserRound } from "lucide-react";

export default function FieldLandingPage() {
  return (
    <main className="field-app" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 520, display: "grid", gap: 20 }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>RADAR MBG</h1>
          <p style={{ color: "#718096", marginTop: 8 }}>Field Operations</p>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <Link href="/radarapp/login" className="field-card" style={{ display: "grid", gap: 12, padding: 24, textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: "#EAF2FF", display: "grid", placeItems: "center", color: "#1677FF" }}>
                <Truck size={32} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>Driver</h2>
                <p style={{ margin: "4px 0 0", color: "#718096", fontSize: 14 }}>Tugas perjalanan, GPS, dan bukti pengiriman</p>
              </div>
            </div>
          </Link>

          <Link href="/radarapp/login" className="field-card" style={{ display: "grid", gap: 12, padding: 24, textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: "#EAF2FF", display: "grid", placeItems: "center", color: "#1677FF" }}>
                <Package size={32} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>Penerima</h2>
                <p style={{ margin: "4px 0 0", color: "#718096", fontSize: 14 }}>Pengiriman ke lokasi Anda dan konfirmasi penerimaan</p>
              </div>
            </div>
          </Link>
        </div>

        <div style={{ textAlign: "center", display: "grid", gap: 8 }}>
          <p style={{ color: "#718096", fontSize: 14 }}>Belum terdaftar?</p>
          <Link href="/radarapp/register" className="btn btn-ghost" style={{ justifyContent: "center" }}>
            <UserRound size={16} /> Ajukan pendaftaran penerima
          </Link>
        </div>
      </div>
    </main>
  );
}