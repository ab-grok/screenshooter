"use client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { logSchema, logType } from "./actions";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ErrDialog } from "@/components/Errordialog";
import { logUser } from "@/lib/sessions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Login() {
  type logInput = "u" | "p" | "";
  const formItems = ["username", "password"];
  const [dialog, setDialog] = useState({ msg: "", danger: false });
  const textChangeTimer = useRef<NodeJS.Timeout | null>(null);
  const [buttonAnim, setButtonAnim] = useState(false);
  const [loading, setLoading] = useState(false);
  const passRef = useRef<HTMLInputElement | null>(null); // can use oneRef, better optimization.
  const nameRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputOffset = useRef({ user: 0, pass: 0 });
  const [currInput, setCurrInput] = useState({
    count: 0,
    name: "" as logInput,
  });
  const initRender = useRef(true);
  // const changeTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  // const [textChange, setTextChange] = useState({uname: false, pass: false})

  const logForm = useForm<logType>({
    resolver: zodResolver(logSchema),
    defaultValues: { username: "", password: "" },
  });

  async function logSubmitted(values: logType) {
    setLoading(true);
    const { error } = await logUser(values.password, values.username);
    setLoading(false);
    setDialog({ msg: error || "Successful!", danger: error ? true : false });
  }

  useEffect(() => {
    //separate into user and pass effects -- better optimized.
    if (initRender.current) {
      canvasRef.current = document.createElement("canvas");
      initRender.current = false;
      return;
    }
    // if (currInput.count < 5) return;
    // console.log("timer effect ran");
    if (textChangeTimer.current) clearTimeout(textChangeTimer.current); //setChangingText clears the prev val -- no need to handle different timeouts
    textChangeTimer.current = setTimeout(() => {
      console.log("timer executed");
      setCurrInput((p) => ({ name: "", count: p.count }));
    }, 3000);
    return () => {
      textChangeTimer.current && clearTimeout(textChangeTimer.current);
    };
  }, [currInput.count]);

  function inputChanged(e: ChangeEvent<HTMLInputElement>) {
    const name = e.target.name as "username" | "password";
    console.log("name from inputChanged: ", name);
    logForm.setValue(name, e.target.value || "");
    setCurrInput((p) => ({
      name: name == "username" ? "u" : "p",
      count: e.target.value.length ?? 0,
    }));
    measureText(e.target);
  }

  function measureText(I: HTMLInputElement) {
    //measures just pass text
    if (canvasRef.current && I.value && I.value.length! > 5) {
      const context = canvasRef.current.getContext("2d")!;
      context.font = getComputedStyle(I).font || "16px san-serif";
      const metrics = context.measureText(I.value);
      inputOffset.current.pass = metrics.width + 8;
    }
  }

  function buttonPressed() {
    setButtonAnim(true);
    setTimeout(() => {
      setButtonAnim(false);
    }, 100);
  }

  return (
    <div className="w-full h-full overflow-auto p-2 px-5 bg-black">
      <ErrDialog msg={dialog.msg} danger={dialog.danger} />
      <Form {...logForm}>
        <form
          onSubmit={logForm.handleSubmit(logSubmitted)}
          className=" flex overflow-hidden p-2 text-white/80 flex-col space-y-[1rem] "
        >
          <section className="font-semibold select-none text-center w-full h-[3rem] text-4xl ">
            Enter into club
            <Separator className="bg-neutral-500" />
          </section>
          <section className="flex flex-col space-y-3">
            {formItems.map((a, i) => (
              <FormField
                control={logForm.control}
                key={i}
                name={a as "username" | "password"}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {a.charAt(0).toUpperCase() + a.slice(1, a.length)}
                    </FormLabel>
                    <FormControl>
                      <div className="flex relative">
                        <Input
                          {...field}
                          ref={a == "password" ? passRef : nameRef}
                          onInput={inputChanged}
                          className="rounded-full h-[3rem] overflow-hidden shadow-md focus:shadow-none ring-white"
                          placeholder=""
                        />
                        <span
                          className={cn(
                            `absolute top-[25%] text-stone-500 font-bold p-1 h-1/2 items-center truncate rounded-full bg-white/20 hidden`,
                            a == "password" && currInput?.name == "p"
                              ? "flex"
                              : "hidden",
                          )}
                          style={{ left: `${inputOffset.current.pass + 8}px` }}
                        >
                          Trying to hack the system I see...
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage className="font-bold" />
                  </FormItem>
                )}
              />
            ))}
          </section>
          <Button
            onClick={() => buttonPressed()}
            type="submit"
            disabled={loading}
            className={cn(
              " transition-all select-none hover:bg-green-600/60 cursor-pointer min-h-[4rem] overflow-hidden shadow-md rounded-full hover:-translate-y-0.5",
              buttonAnim && "scale-[99.5%] hover:translate-y-0.5 shadow-none",
            )}
          >
            <span
              className={cn(
                loading &&
                  "scale-x-[300] scale-y-200 transition-all duration-[20s]",
              )}
            >
              {!loading ? "Sign in" : "..."}
            </span>
          </Button>
        </form>
      </Form>
    </div>
  );
}
