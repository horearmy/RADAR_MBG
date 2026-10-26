import type { Metadata } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "RADAR MBG — Pusat Operasional",
  description: "Control tower pemantauan distribusi Makan Bergizi Gratis.",
  manifest: "/manifest.webmanifest",
  applicationName: "RADAR MBG",
  appleWebApp: { capable: true, title: "RADAR MBG", statusBarStyle: "default" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
