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
import { ErrDialog } from "@/components/errordialog";
import { logUser } from "@/lib/sessions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Login() {
  const formItems = ["username", "password"];
  const textChanging = useRef(false);
  const [inputCount, setInputCount] = useState(0);
  const [buttonAnim, setButtonAnim] = useState(false);
  const [dialog, setDialog] = useState({ msg: "", danger: false });
  // const changeTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  // const [textChange, setTextChange] = useState({uname: false, pass: false})

  const logForm = useForm<logType>({
    resolver: zodResolver(logSchema),
    defaultValues: { username: "", password: "" },
  });

  async function logSubmitted(values: logType) {
    const { error } = await logUser(values.password);
    setDialog({ msg: error || "Successful!", danger: error ? true : false });
  }

  useEffect(() => {
    if (logForm.getValues("username") || logForm.getValues("password")) {
      if (!textChanging.current) {
        textChanging.current = true;
        setTimeout(() => {
          textChanging.current = false;
        }, 3000);
      } else {
      }
    }
  }, [inputCount]);

  function inputChanged(e: ChangeEvent<HTMLInputElement>) {
    const name = e.target.name as "username" | "password";
    console.log("name from inputChanged: ", name);
    logForm.setValue(name, e.currentTarget.value);
    setInputCount((p) => p + 1);
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
          className=" flex text-white/80 flex-col space-y-[1rem] "
        >
          <section className=" font-semibold select-none pointer-coarse: text-center p-2 w-full h-[3rem] text-4xl ">
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
                      <Input
                        {...field}
                        onInput={inputChanged}
                        className="rounded-full h-[3rem] shadow-md focus:shadow-none ring-white"
                        placeholder=""
                      />
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
            className={cn(
              " transition-all select-none hover:bg-green-600/60 cursor-pointer min-h-[4rem] shadow-md rounded-full hover:-translate-y-0.5",
              buttonAnim && "scale-[99.5%] hover:translate-y-0.5 shadow-none"
            )}
          >
            {" "}
            Sign in{" "}
          </Button>
        </form>
      </Form>
    </div>
  );
}
