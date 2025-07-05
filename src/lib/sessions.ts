"use server";
import { randomBytes } from "crypto";
import { encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";
import { cookies } from "next/headers";
import { createSession } from "./server";

export async function getCookies() {
  const token32 = (await cookies()).get("session");
  return token32;
}

async function createToken32() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const token32 = encodeBase32LowerCaseNoPadding(bytes);
  return token32;
}

async function createCookie(token32: string) {
  (await cookies()).set("session", token32, {
    expires: new Date(Date.now() + 1000000),
    sameSite: "lax",
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV == "production",
  });
}

export async function logUser(password: string) {
  try {
    const token32 = await createToken32();
    const { error } = await createSession(password, token32);
    if (!error) await createCookie(token32);
    return { error };
  } catch (e) {
    return { error: "Something went wrong in logUser!" };
  }
}
