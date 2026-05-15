import { redirect } from "next/navigation";
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const res = await fetch(process.env.PUBLIC_NEXT_WRK + "/validateSession");
  if (res.ok && !(await res.json()).error) redirect("/");

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-black/90">
      <main className="flex h-1/2 w-1/2 min-w-[20rem] flex-col overflow-hidden rounded-xl ring-2 ring-stone-600">
        {children}
      </main>
    </div>
  );
}
