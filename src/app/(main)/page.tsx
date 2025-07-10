"use client";
import { Separator } from "@/components/ui/separator";
import { makeEntry } from "@/lib/server";

export default function Main() {
  async function addEntry() {
    const date = new Date();
    const name = "shot-" + date.toLocaleString();
    const buffer = 123;
    // const {error} = await makeEntry(buffer)
  }

  return (
    <div className="relative flex-col min-h-screen min-w-screen space-y-2 bg-black/40 flex text-white">
      <header className="sticky top-0 bg-neutral-800 w-full h-[4rem] border-b-2 border-stone-400 p-2">
        {" "}
        hello{" "}
      </header>
      {/* <Separator orientation="horizontal" /> */}
      <main className="p-2 bg-black">
        <section className=" h-[20rem] p-2 overflow-auto bg-teal-600 ring-2 shadow-sm flex-1 "></section>
      </main>
    </div>
  );
}

//Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0
//Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36
