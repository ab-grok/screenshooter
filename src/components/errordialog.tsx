"use client";

import { useRootContext } from "@/app/(main)/layoutcontext";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function ErrDialog({ msg, danger }: { msg?: string; danger?: boolean }) {
  const { errLog, setErrLog } = useRootContext();
  const [anim, setAnim] = useState({ a: false, b: false });

  useEffect(() => {
    if (msg || errLog?.msg) {
      setAnim({ a: true, b: false });
      setTimeout(() => {
        setAnim({ a: true, b: true });
        setTimeout(() => {
          exitAnim();
        }, 5000);
      }, 1000);
    }
  }, [errLog?.msg]);

  function exitAnim() {
    setAnim({ a: true, b: false });
    setTimeout(() => {
      setAnim({ a: false, b: false });
    }, 1000);
  }

  return (
    <div
      className={cn(
        "absolute top-3 z-5 min-w-1/2 rounded-xl ring-2 shadow-sm flex items-center justify-center p-1",
        anim.a ? "flex" : "hidden",
        danger || errLog?.danger ? "ring-red-600" : "ring-green-600"
      )}
    >
      <div
        className={cn(
          "overflow-hidden rounded-xl bg-neutral-800/20 text-center ",
          anim.b ? "h-[5rem]" : "max-h-0.5"
        )}
      >
        {" "}
        {errLog?.msg || ""}{" "}
      </div>
    </div>
  );
}
