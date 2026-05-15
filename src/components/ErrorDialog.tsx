//src/components/ErrorDialog.tsx
"use client";

import { useRootContext } from "@/app/(main)/rootcontext";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function ErrDialog({ msg, danger }: { msg?: string; danger?: boolean }) {
  const { errBox, setErrBox } = useRootContext();
  const [anim, setAnim] = useState({ a: false, b: false });

  useEffect(() => {
    console.log(
      "in errDialog, msgProp: ",
      msg,
      " dangerProp: ",
      danger,
      " errBox: ",
      JSON.stringify(errBox),
    );
    if (msg || errBox?.msg) {
      setAnim({ a: true, b: false });
      setTimeout(() => {
        setAnim({ a: true, b: true });
        setTimeout(() => {
          exitAnim();
        }, 5000);
      }, 1000);
    }
  }, [errBox?.msg]);

  function exitAnim() {
    setAnim({ a: true, b: false });
    setTimeout(() => {
      setAnim({ a: false, b: false });
    }, 1000);
  }

  return (
    <div
      className={cn(
        //fix layout for both mobile and desktop;
        "absolute top-3 left-1/2 z-5 flex w-1/2 min-w-[16rem] -translate-x-1/2 items-center justify-center rounded-3xl bg-black/70 p-1 font-semibold text-white/80 shadow-lg ring-2 shadow-black sm:left-1/4 sm:min-w-[20rem]",
        anim.a ? "flex" : "hidden",
        danger || errBox?.danger ? "ring-red-600" : "ring-green-600",
      )}
    >
      <div
        className={cn(
          "flex items-center overflow-hidden rounded-xl bg-neutral-800/20",
          anim.b ? "h-20" : "max-h-0.5",
        )}
      >
        {errBox?.msg || ""}
      </div>
    </div>
  );
}
