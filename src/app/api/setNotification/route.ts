//src/app/api/setNotification/route.ts

import { setNotification } from "@/lib/server";
import * as jose from "jose";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const token = req.headers.get("Authorization")!;
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    const { payload } = await jose.jwtVerify(token, secret);

    const data = await req.json();
    const { msgData } = data;
    if (!msgData) throw { error: data };

    const { error } = await setNotification({ ...data } as noti);
    if (error) throw { error };
  } catch (e) {
    console.error("Error in setNotification (API). data: ", e);
  }
}

type noti = {
  msgData: any;
  user?: string;
  del?: boolean;
  postAdmin?: boolean;
};
