import { redirect } from "next/navigation";
import { validateSession } from "@/lib/server";
import { ErrDialog } from "@/components/errordialog";
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { error } = await validateSession();
  if (!error) redirect("/");

  return (
    <div className="w-screen h-screen relative flex-col bg-black/90 items-center justify-center flex">
      <main className="rounded-xl h-1/2 w-1/2 ring-2 overflow-hidden ring-stone-600 flex flex-col">
        {children}
      </main>
    </div>
  );
}
