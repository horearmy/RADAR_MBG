"use client";

import Image from "next/image";
import Link from "next/link";
import { Package, Truck, UserRound } from "lucide-react";
import desktopBg from "@/bg/dekstop.webp";
import mobileBg from "@/bg/mobile.webp";

export default function FieldLandingPage() {
  return (
    <main className="field-app" style={{ position: "relative", minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, overflow: "hidden" }}>
      <Image src={desktopBg} alt="" fill priority className="hidden md:block" style={{ objectFit: "cover" }} />
      <Image src={mobileBg} alt="" fill priority className="md:hidden" style={{ objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(7,27,58,.78), rgba(7,27,58,.45))", zIndex: 1 }} />
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 520, display: "grid", gap: 20 }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "#fff" }}>RADAR MBG</h1>
          <p style={{ color: "#cbd5e1", marginTop: 8 }}>Field Operations</p>
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
          <p style={{ color: "#cbd5e1", fontSize: 14 }}>Belum terdaftar?</p>
          <Link href="/radarapp/register" className="btn btn-ghost" style={{ justifyContent: "center", color: "#fff" }}>
            <UserRound size={16} /> Ajukan pendaftaran penerima
          </Link>
        </div>
      </div>
    </main>
  );
}