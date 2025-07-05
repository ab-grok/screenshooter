"use server";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase64NoPadding } from "@oslojs/encoding";
import { cookies } from "next/headers";
import postgres from "postgres";
import { start } from "repl";

const shot = postgres(process.env.SHOOTDB, {
  debug: (connection, query, params) => {
    console.log("Query: ", query);
    console.log("Params: ", params);
  },
});
//safe start e: 1478000 - 1693000, c: 1665000 - 1922000
const eRange = { start: 1478000, end: 1693000 };
const cRange = { start: 1665000, end: 1922000 };

export async function makeEntry(file, date, html, c) {
  if (!file.fileData) return { error: "No file" };
  try {
    await validateEntry(html, c);
    const { fileData, fileName, fileType } = file;
    const fileMeta = shot`ROW(${fileName}, ${fileData}, ${fileType}) :: filemeta`;
    const res =
      await shot`insert into "private"."snapshots" (date, html, shots ) values (${date}, ${html}, ${fileMeta})`;
  } catch (e) {
    console.log("Error in makeEntry: ", e);
    return { error: "problem with insert. " + e.error || "" };
  }
}

async function validateEntry(html, c) {
  const start = c ? cRange.start : eRange.start;
  const end = c ? cRange.end : eRange.end;
  const updHtml = html.slice(start, end);
  //start e: 1477865, c: 1664160 -- end e: 1693003  c: 1868906 / 1922007

  const res =
    await shot`select html from "private"."session" order by id desc limit 1  `;
  console.log("res from validateEntry:", res);
  if (res[0].html.includes(updHtml)) throw { error: "HTML already exists" };
}

export async function validateSession() {
  const token32 = (await cookies()).get("session")?.value;
  if (!token32) return { error: "No session token" };
  try {
    const hex = encodeBase64NoPadding(
      sha256(new TextEncoder().encode(token32))
    );
    const res =
      await shot`select password from "private"."session" where session = ${hex} `;
    console.log("res from validateSession:", res[0]);
    return { error: "" };
  } catch (e) {
    console.log("Error in validateSession: ", e);
    return { error: "Couldn't probe db for session" };
  }
}

export async function createSession(token32, password) {
  try {
    const res =
      await shot`select "sessionId" from "private"."session" where password = ${password}`;
    if (!res[0].sessionId) return { error: "Unknown user" };
    const hex = encodeBase64NoPadding(
      sha256(new TextEncoder().encode(token32))
    );
    const res1 =
      await shot`insert into "private"."session" (password, token32) values (${password}, ${token32}) where`;
    return { error: "" };
  } catch (e) {
    console.log("Error in createSession: ", e);
    return { error: "Couldn't create user" };
  }
}
