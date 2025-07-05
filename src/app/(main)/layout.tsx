//"use client";
import { validateSession } from "@/lib/server";
import { redirect } from "next/navigation";
import { RootLayoutContext } from "./layoutcontext";
import { ErrDialog } from "@/components/errordialog";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { error } = await validateSession();
  if (error) redirect("/login?unkown_user=true");
  return (
    <div className="relative">
      <RootLayoutContext>
        <ErrDialog />
        {children}
      </RootLayoutContext>
      ;
    </div>
  );
}
