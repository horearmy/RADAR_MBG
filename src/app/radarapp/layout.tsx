// Layout Field App. Autentikasi & role resolution dilakukan per halaman dari
// respons server (resolveWorkspaces); layout tidak lagi memblokir render dengan
// spinner agar halaman tidak tertahan di "Memuat...". Perlindungan data tetap
// ditegakkan backend, bukan oleh redirect frontend.

export default function RadarAppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
