"use client";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { shot, useRootContext } from "./layoutcontext";

export default function Main() {
  const { setErrBox } = useRootContext();
  const [cShots, setCShots] = useState([] as shot[]);
  const [eShots, setEShots] = useState([] as shot[]);

  useEffect(() => {
    setInterval(() => {
      fetchShots();
    }, 1000 * 60 * 5); // 5 minutes interval
  }, []);

  function fetchShots() {
    //{cHtml: string, cShots: file}[]
    const res = fetch(`${process.env.NEXT_PUBLIC_WKR}/getShots`, {
      headers: {
        AuthToken: process.env.NEXT_PUBLIC_AUTH || "",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setErrBox({ msg: data.error, danger: true });
          return;
        }

        setCShots(data.cs);
        setEShots(data.es);
      });
  }

  return (
    <div className="relative flex-col min-h-screen min-w-screen space-y-2 bg-black/40 flex text-white">
      <header className="sticky top-0 bg-neutral-800 w-full h-[4rem] border-b-2 border-stone-400 p-2">
        {" "}
        hello{" "}
      </header>
      {/* <Separator orientation="horizontal" /> */}
      <main className="p-2 bg-slate-700 h-full w-full ">
        <section className=" h-[20rem] p-2 overflow-auto bg-teal-600 ring-2 shadow-sm flex-1 "></section>
      </main>
    </div>
  );
}

//Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0
//Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36
