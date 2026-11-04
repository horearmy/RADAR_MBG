"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getCurrentSession, type SessionUser } from "@/lib/api";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}