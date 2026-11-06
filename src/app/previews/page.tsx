"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RecipientReviewPanel } from "@/components/recipient-review-panel";

export default function PlatformReviewsPage() {
  return (
    <main className="platform-reviews-page">
      <header className="page-header">
        <div>
          <p className="page-breadcrumb">PLATFORM / REVIEW PENERIMA</p>
          <h1 className="page-title">Review Penerima</h1>
          <p className="page-subtitle">Ringkasan rating, emoji, dan komentar penerima lintas tenant.</p>
        </div>
        <Link className="btn" href="/">
          <ArrowLeft size={14} /> Kembali ke dashboard
        </Link>
      </header>

      <section className="panel review-panel" aria-label="Review penerima">
        <RecipientReviewPanel />
      </section>
    </main>
  );
}
