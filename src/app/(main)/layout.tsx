"use client";
import { validateSession } from "@/lib/server";
import { redirect } from "next/navigation";
import { RootLayoutContext } from "./layoutcontext";
import { ErrDialog } from "@/components/errordialog";

// // Client-side (not Worker)
// import FingerprintJS from '@fingerprintjs/fingerprintjs';
// const fp = await FingerprintJS.load();
// const result = await fp.get();
// const fingerprint = result.visitorId; // e.g., 'a1b2c3d4'
// // Send fingerprint to Worker for logging

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_WKR}/validateSession`, {
    headers: {
      AuthToken: process.env.NEXT_PUBLIC_AUTH || "",
    },
  });

  const { error } = await res.json();
  if (error || !res.ok) redirect("/login?user=unknown");

  return (
    <div className="relative flex h-full w-full">
      <RootLayoutContext>
        <ErrDialog />
        {children}
      </RootLayoutContext>
    </div>
  );
}
