//src/app/api/makeEntry/route.ts

import { makeEntry, setNotification } from "@/lib/server";
import * as jose from "jose";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const token = req.headers.get("Authorization")!;
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    const { payload } = await jose.jwtVerify(token, secret);

    const { site, user, ...rest } = await req.json();
    if (!user || !site) throw { error: "Missing parameters from worker call" };

    const { error } = await makeEntry({ ...rest, site, user });
    if (error) throw { error };
  } catch (e) {
    const msg = `Error in makeEntry API: ${JSON.stringify(e)}`;
    const msgData = { msg, danger: true };
    await setNotification({ msgData, postAdmin: true });
  }
}
