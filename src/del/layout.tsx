import { redirect } from "next/navigation";
import { validateSession } from "@/lib/server";
import { ErrDialog } from "@/components/Errordialog";
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const res = await fetch(process.env.PUBLIC_NEXT_WRK + "/validateSession");
  if (res.ok && !(await res.json()).error) redirect("/");

  return (
    <div className="w-screen h-screen relative flex-col bg-black/90 items-center justify-center flex">
      <main className="rounded-xl h-1/2 w-1/2 min-w-[20rem] ring-2 overflow-hidden ring-stone-600 flex flex-col">
        {children}
      </main>
    </div>
  );
}
