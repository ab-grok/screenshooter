"use client";

import { useRootContext } from "@/app/(main)/layoutcontext";
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
      JSON.stringify(errBox)
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
        "absolute top-3 z-5 w-1/2 sm:left-1/4 left-1/10 min-w-[16rem] sm:min-w-[20rem] rounded-3xl ring-2 shadow-lg shadow-black bg-black/70 text-white/80 font-semibold flex items-center justify-center p-1",
        anim.a ? "flex" : "hidden",
        danger || errBox?.danger ? "ring-red-600" : "ring-green-600"
      )}
    >
      <div
        className={cn(
          "overflow-hidden rounded-xl bg-neutral-800/20 flex items-center ",
          anim.b ? "h-[5rem]" : "max-h-0.5"
        )}
      >
        {errBox?.msg || ""}
      </div>
    </div>
  );
}
