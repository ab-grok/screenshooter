"use server";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase64NoPadding } from "@oslojs/encoding";
import { cookies } from "next/headers";
import postgres from "postgres";
require("dotenv").config();

const db = postgres(process.env.DB, {
  debug: (connection, query, params) => {
    console.log("Query: ", query);
    console.log("Params: ", params);
  },
});
//safe start e: 1478000 - 1693000, c: 1665000 - 1922000
const eRange = { start: 1480000, end: 1820000 };
const cRange = { start: 1665000, end: 1900000 };

export async function makeEntry(file, date, html, c) {
  if (!file.fileData) return { error: "No file" };
  try {
    await validateEntry(html, c);
    const { fileData, fileName, fileType } = file;
    const fileMeta = db`ROW(${fileName}, ${fileData}, ${fileType}) :: filemeta`;
    const res = await db`insert into "private"."snapshots" (date, ${
      c ? db`, c_html, c_shot` : db`, e_html, e_shot`
    }) values (${date}, ${html}, ${fileMeta})`;
    return { error: null };
  } catch (e) {
    console.log("Error in makeEntry: ", e);
    return { error: "problem with insert. " + e.error || "" };
  }
}

async function validateEntry(html, c) {
  const start = c ? cRange.start : eRange.start;
  const end = c ? cRange.end : eRange.end;
  const updHtml = html.slice(start, end);
  //start e: 1477865/1609938, c: 1664160/1663495 -- end e: 1693003 / 1820704  c: 1868906 / 1922007 / 1894144

  const res = await db`select ${
    c ? db`c_html` : db`e_html`
  } from "private"."session" order by id desc limit 1  `;
  console.log("res from validateEntry:", res);
  if (res[0].html.includes(updHtml)) throw { error: "HTML already exists" };
}

export async function validateSession() {
  const token32 = (await cookies()).get("session")?.value;
  if (!token32) return { error: "No valid session" };
  try {
    const hex = encodeBase64NoPadding(
      sha256(new TextEncoder().encode(token32))
    );
    const res =
      await db`select password from "private"."session" where "sessionId" = ${hex} order by id desc limit 1 `;
    console.log("res from validateSession:", res);
    if (!res[0].password) throw { error: "Unknown user" };
    return { error: "" };
  } catch (e) {
    console.log("Error in validateSession: ", e);
    return { error: "Couldn't probe db for session" };
  }
}

export async function createSession(token32, password, username) {
  try {
    const res =
      await db`select "sessionId" from "private"."session" where password = ${password} order by id desc limit 1 `;
    console.log("res from createSession: ", res);
    if (!res[0]) return { error: "Unknown user" };
    const hex = encodeBase64NoPadding(
      sha256(new TextEncoder().encode(token32))
    );
    const res1 =
      await db`insert into "private"."session" ("sessionId", password, username) values (${hex}, ${password}, ${username}) `;
    return { error: "" };
  } catch (e) {
    console.log("Error in createSession: ", e);
    return { error: "Couldn't create user" };
  }
}
