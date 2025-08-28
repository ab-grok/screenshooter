"use server";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import bcrypt from "bcryptjs";
import postgres, { Sql } from "postgres";
import { v4, validate } from "uuid";
import { getCookie } from "./actions";

export function DB(conn) {
  if (!db && conn) {
    db = postgres(conn, {
      debug: (connection, query, params) => {
        console.log("Query: ", query);
        console.log("Params: ", params);
      },
    });
  }
  return db;
}
// export let db: Sql<{}> | undefined;
let db: Sql<{}> = DB(process?.env?.DB_CONN);

const eRange = { start: 1480000, end: 1820000 };
const cRange = { start: 1665000, end: 1900000 };

//------> shooterWorker actions
export async function makeEntry({ env, shotData }) {
  try {
    DB(env.DB_CONN);
    const time = Date.now();
    let currCount = 0;
    for (const { shot, range, html, user, site } of shotData) {
      //account for when shotData is missing shot, site should be safe.
      let ss = safeSite(site, "noDots");
      const uT = db(user);

      if (ss) {
        const fileName = ss + "_" + time;
        const fileType = "image/png";
        const fileData = shot;
        const sD = { fileName, fileType, fileData };
        const sC = db(ss + "_shot");
        const hC = db(ss + "_html");
        let updHtml = html;

        try {
          currCount++;
          //columns should exist - created in createShotSchema
          const sHD = { html, hC, ...(range ? { range } : {}) };
          if (await entryExists({ sHD, user, env })) {
            sD.fileData = "Unchanged";
            sD.fileType = "text/plain";
            updHtml = null;
          }

          await db`insert into "public".${uT} (${sC}, ${hC}) values (${sD}, ${updHtml}) `;
          await db`update "private"."users" set unviewed = jsonb_build_object('date', case when unviewed -> 'date' = 'null' to_char(now(), 'YYYY:MM:DD"T"HH24:MI:SS"Z"') else unviewed ->> 'date', 'count', (unviewed -> 'count')::integer+1) where username = ${user}`;
        } catch (e) {
          const errTrace = { shotsCount: shotData?.length, currCount, user };
          console.error(`in makeEntry. Error during insert: ${errTrace}`);
        }
      } else
        console.error(
          `in makeEntry: ${JSON.stringify({
            user,
          })} had unsafe ${JSON.stringify({ site })}`
        );
    }
    return { error: null };
  } catch (e) {
    console.error("Error in makeEntry: ", e);
    return { error: "problem while inserting shot. " + e.error };
  }
}

// async function readyUsers(shotData, env) {
//   //indicator that worker ran but no update was made -- just paste timestamp
//   try {
//     DB(env.DB_CONN);
//     if (!shotData[0]?.shot) {
//       for (const { user, shot, html, time } of shotData) {
//         const u = db("");
//         //get user table, column -- post in it
//         const res = await db`insert `;
//       }
//     } else throw { error: "shotData had no entry!" };
//   } catch (e) {}
// }

async function entryExists({ sHD, user, env }) {
  try {
    //hC: htmlCol: checks if the selected part of a new shot matches a previous entry.
    //start e: 1477865/1609938, c: 1664160/1663495 -- end e: 1693003 / 1820704  c: 1868906 / 1922007 / 1894144
    const { html, range, hC } = sHD;
    if (!html || !env || (range && !safeRange(range)))
      throw { error: "Missing parameters" };
    DB(env.DB_CONN);

    let partHtml = html;
    if (range) {
      const { start, end } = range;
      partHtml = html.slice(start, end);
    }
    // consumes more worker compute than neon's
    const res = await db`select  ${hC} as html from "public".${db(
      user
    )} orderby date desc limit 1`;

    if (res[0].html && html.includes(partHtml)) return true;
    return false;
  } catch (e) {
    console.error("error in entryExists. ", e);
    return false;
  }
}

export async function getCronSites(cronTrigger, env) {
  //cron call from worker
  //check the lastLog of cron user -- include only sites from users < 3 mos -- optionally delete cron from table
  try {
    DB(env.DB_CONN);
    const readySites = []; //cronData: site, range, user

    const r1 =
      await db`select "cronData" as cD from "private"."crons" where cron = ${cronTrigger}`;
    if (!r1[0]) {
      const user = "cleanUp";
      const { error } = await updateWorker({ cron, user, del: true, env });

      if (!r1[0].cD.length) {
        await db`delete from "private"."crons" where cron = ${cronTrigger}`;
        if (error) throw { error };
        throw { error: "in getCronSites. No sites found. Ran cron cleanup" };
      }
      throw { error: "in getCronSites. Cron not found. Ran cleanup " };
    }

    for (const { site, range, user } of r1[0].cD) {
      //{user, site, range}[]
      //shorter than latter cause that finds inner cron matches in sites arr but this has matches aready sorted
      //need to get
      let staleTime = new Date();
      staleTime.setMonth(staleTime.getMonth() - 3);

      const r2 =
        await db`select "lastLog" from "private"."users" where uuid = ${uuid} `;
      if (!r2[0]) console.log("in getCronSites. No lastLog");
      if (r2[0]?.lastLog < staleTime) {
      }

      readySites.push({ user, site, range });
    }

    const allSites =
      await db`select sites, username as user from "private"."users"`;
    if (allSites[0]) {
      for (const { sites, user } of allSites) {
        const siteData = sites.find((s) => s.cron == cronTrigger && s.site);
        if (siteData) readySites.push({ siteData, user });
      }
      console.log(`In getCronSites. allSites: ${{ cronTrigger, readySites }}`);
      return { readySites };
    } else {
      const { error } = await updateWorker({ cron, user, del: true, env });
      throw { error: "No sites found. Ran cleanup: ", error };
    }
  } catch (e) {
    console.error("error in getCronSites: ", e);
    return { error: "Couldn't get Cron Sites. " + e.errror };
  }
}

export async function pauseCron() {
  //when the user is away for 3 months or need to clean
}

//---------> client actions
async function getUserShots({ renderedShots }) {
  //renderedShots:rS: {site, count}
  //sitesShot: {site, shots: []}[]
  try {
    const { error, user } = await validateSession();
    if (error) throw { error };

    const res =
      await db`select sites from "private"."users" where username = ${user} `;
    if (!res[0]) throw { error: "User has no sites" };

    // const uSites = res[0].sites.map((s) => safeSite(s.site, "noDots"));
    const sitesShot = [];
    for (const { site } of res[0]) {
      const saferSite = safeSite(site, "noDots");
      const hC = db(`${saferSite}_html`);
      const sC = db(`${saferSite}_shot`);
      const u = db(user);

      const rS = renderedShots;
      const rSCount = (rS?.site == site && rS.count) || 0;

      const res1 =
        await db`select ${hC}, ${sC} from "public".${u} orderby date desc offset ${rSCount} limit 10`;

      sitesShot.push({ site: saferSite, shots: res1 });
    }

    return { sitesShot };
  } catch (e) {
    console.error("Error in getUserShots: ", e);
    return { error: "Couldn't get userShots " + e.error };
  }
}

export async function getVisitorShots({ renderedShots }) {
  try {
    const saferS = safeSite(process.env.VSITE, "noDots");
    const vShot = db(`${saferS}_shot`);
    const vHtml = db(`${saferS}_html`);
    const tb = db(process.env.VTB);
    const rSCount =
      (renderedShots.site == "visitor" && renderedShots.count) || 0;

    const res =
      await db`select ${vShot}, ${vHtml} from ${tb} offset ${rSCount} limit 10 `;
    if (!res[0]) throw { error: "Zero rows in visitor table." };
    return { site };
  } catch (e) {
    console.error("Error in getVisitorShots. ", e);
    return {};
  }
}

export async function unPauseCron({ cron }) {
  //you'll need to reinsert the cronData in "private"."crons";
}

//----------> cron scheduling
export async function createShotSchema(site, user, del) {
  try {
    const saferSite = safeSite(site, "noDots");
    if (!saferSite) throw { error: "Invalid site" };
    const { tableName, prevSites } = await getUserTable({ user });

    const u = db(user),
      htmlCol = db(saferSite + "_html"),
      shotCol = db(saferSite + "_shot");

    if (!tableName) {
      if (del)
        await db`create table "public".${u} (id serial primary key, date timestamp default now())`;
      else
        await db`create table "public".${u} (id serial primary key, date timestamp default now(), ${htmlCol} text, ${shotCol} jsonb)`;
    } else {
      if (del)
        await db`alter table "public".${u} drop column if exists ${htmlCol}, drop column if exists ${shotCol}`;
      else
        await db`alter table "public".${u} add column if not exists ${htmlCol} text, add column if not exists ${shotCol} jsonb`;
    }

    return { user, saferSite, prevSites };
  } catch (e) {
    console.error("error in createShotSchema: ", e);
    return { error: "Couldn't createShotSchema. " + e.error };
  }
}

export async function updateUserSites({ safeSD, prevSites, user, del }) {
  //Not accounting for del when 'prevSites'.

  try {
    const { cron, site: sS, range: sR } = safeSD;
    if (!cron || !sS) throw { error: "Missing parameters" };

    if (prevSites?.[0]) {
      const tS = prevSites.find((p) => p.site == sS) || {};
      let updSite = {};
      const { start: a, end: b } = tS?.range;

      if (cron != tS?.cron || (sR && (sR?.end != b || sR?.start != a))) {
        updSite = {
          site,
          ...(cron != tS.cron ? { cron } : {}),
          ...(sR && (sR?.end != b || sR.start != a) ? { sR } : {}),
          active: true,
        };

        updSite = { ...tS, ...updSite };
        const allSiteArr = [...prevSites.filter((p) => p.site != sS), updSite];
        const allSiteStr = allSiteArr.reduce(
          (acc, s, i) =>
            i == 0 ? db`'${s}'::jsonb` : db`${acc}, '${s}'::jsonb`,
          db``
        );

        await db`update "private"."users" set sites = array[${allSiteStr}] where username = ${user}`;
      } else console.log("in updateUserSites. No change to cron and range ");
    } else {
      //must filter based on user && site as differnt users may have the same site
      if (del)
        await db`update "private"."users" set sites = array(select s from unnest(sites) as s where s ->> 'site' != ${sS} ) where username = ${user}`;
      let updSite = { cron: sC, site: sS, range: sR, active: true };
      await db`update "private"."users" set sites = array['${updSite}'::jsonb] where username = ${user}`;
    }
    return { error: null };
  } catch (e) {
    console.error("Error in updateUserSites: ", e);
    return { error: "Couldn't update user cron " + e.error };
  }
}

export async function updateCronTable({ safeSD, user, del }) {
  //accounting for new Crons -- its much better to handle 'deleting from cron table' in a separate function and pass the new cron to this one.
  //function can either add to cron table or delete -- no need for newSD;
  try {
    const { cron, site, range } = safeSD;
    const cronData = { user, site, ...(range ? { range } : {}) };

    const r1 = await db`select cron from "private"."crons"`;
    if (r1[0]) {
      const sameCron = r1.find((c) => c.cron == cron);

      if (!sameCron) {
        if (del) throw { error: "Cron does not exist!" };
        const r2 = await db`select "maxCrons" from "private"."settings"`;
        const maxCrons = r2[0]?.maxCrons || 5;

        if (r1.length >= maxCrons)
          throw { error: "Maximum number of active crons reached." };

        await db`insert into "private"."crons" (cron, "cronData") values (${cron}, array['${cronData}'::jsonb])`;
        return { error: null };
      }
      if (del) {
        const r3 =
          await db`update "private"."crons" set "cronData" = array(select c from unnest("cronData") as c where not (c ->> 'site' = ${site} and c ->> 'user' = ${user})) where cron = ${cron} returning *`;
        if (r3[0])
          if (!r3[0].cronData?.length)
            await db`delete from "private"."crons" where cron = ${cron}`;
      } else
        await db`update "private"."crons" set "cronData" = case when exists (select 1 from unnest("cronData") as c where c ->> 'site' = ${site} and c ->> 'user' = ${user}) then "cronData" else array_append( "cronData", '${cronData}'::jsonb ) end where cron = ${cron}`;

      return { error: null, noCrons: true };
    }
    console.error("in updateCronTable. No crons found.");

    await db`insert into "private"."crons" (cron, cronData) values (${cron}, array['${cronData}'::jsonb])`;
    return { error: null };
  } catch (e) {
    console.error("in updateCronTable. ", e);
    return { error: "Couldn't add cron to table. " + e.error };
  }
}

export async function updateWorker({ safeSD, user, del }) {
  try {
    //can do better filtering: select the high order schedule and probe db for all fitting crons
    //used env to allow calling from worker -- but noCrons from updateUserCrons will trigger deletions for empty crons mitigating worker calls need

    const { site, cron } = safeSD;
    if (!cron) throw { error: "Cron not provided or invalid" };

    let shooterUrl = process.env.SHOOTER_URL;

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SHOOTER_KEY}`,
    };
    console.log("in UpdateWorker. ", { shooterUrl, headers });

    const res1 = await fetch(shooterUrl + "/schedules", {
      headers,
    });

    const worker = await res1?.json();
    if (!res1.ok)
      throw { error: "ShooterWorker API fetch failed: " + worker?.error };
    console.log("in UpdateWorker. ", { cron, worker });

    const prevCrons = worker.result?.schedules || []; //{cron: "* * *"}[]
    const thisCron = prevCrons.find((s) => s.cron == cron);
    let updCrons = null;

    if (thisCron) {
      if (!del) throw { error: `Cron already exists.` };
      updCrons = prevCrons.filter((c) => c.cron != cron);
    } else {
      if (del) throw { error: `Cron doesn't exist.` };
      updCrons = [...prevCrons, { cron }];
    }

    console.log("in updateWorker. ", { updCrons });
    const res2 = await fetch(shooterUrl + "/schedules", {
      method: "PUT",
      headers,
      body: JSON.stringify(updCrons),
    });

    const res2a = await res2?.json();
    if (!res2.ok) throw { message: "Put failed", error: res2a.errors };
    return { error: null };
  } catch (e) {
    console.error(`Error in updateWorker. User: ${user}, Error ${e}`);
    return { error: "Error updating worker. " + e.error };
  }
}

//-------> User actions
export async function createSession(password, username) {
  try {
    if (!password || !username) throw { error: "Missing credentials" };
    // DB(env.DB_CONN);
    const cookie = createCookie();
    const hex = getHex(cookie);
    const { sid, uid } = await checkUser({ username, password });
    if (sid)
      await db`update "private"."sessions" set "sessionId" = ${hex}, time = now() where uuid = ${uid}`;
    else
      await db`insert into "private"."sessions" ("sessionId", uuid, time) values (${hex}, ${uid}, now())`;

    return { cookie, error: "" };
  } catch (e) {
    console.error("Error in createSession: ", e);
    return { cookie: "", error: "Couldn't create session!" };
  }
}

export async function validateSession(expires) {
  //"expires" updates lastLog too.
  try {
    cookie = await getCookie("session");
    if (!cookie) throw { error: "Invalid session" };

    const hex = getHex(cookie);
    const res =
      await db`select u.username as user, uuid from "private"."sessions" inner join "private"."users" u on u.uuid = uuid where "sessionId" = ${hex}`;
    console.log("res from validateSession:", res);

    if (!res[0]) throw { error: "Unknown user" };
    if (expires) {
      await db`update "private"."sessions" set "lastLog" = now(), expires = ${expires} where uuid = ${res[0].uuid}`;
    }
    return { user: res[0].user, uid: res[0].uuid, cookie };
  } catch (e) {
    console.error("Error in validateSession: ", e);
    return { error: "Trouble validating user! " + e.error };
  }
}

export async function deleteSession() {
  try {
    cookie = await getCookie("session");
    const s = getHex(cookie);
    const res = db`update "private"."sessions" set "sessionId" = null where "sessionId" = ${s}`;
    return { error: null };
  } catch (e) {
    console.error("in deleteSession. Error: ", e);
    return { error: "Something went wrong!" };
  }
}

export async function checkUser({ username, password }) {
  //uid is defined only when the pass is matched
  try {
    if (!username || !password) throw { error: "Missing credentials" };
    const r =
      await db`select username as user, password as pass, uuid, s."sessionId" as "sid" from "private"."users" left join "private"."sessions" s on uuid = s.uuid where username = ${username}`;
    if (!r.length) throw { error: "User does not exist" };

    const samePass = bcrypt.compare(password, r[0].pass);
    if (samePass) return { user: r[0].user, sid: r[0].sid, uid: r[0].uuid };
    else return { user: r[0].user };
  } catch (e) {
    console.error("Error in checkUser: ", e);
    return { error: e.error || "Couldn't confirm user." };
  }
}

export async function createUser({ u, site, cron, range }) {
  try {
    const { username, password } = u;
    if (!username || !password) throw { error: "Missing parameters" };

    const { user } = await checkUser({ username, password });
    if (user) throw { error: "User Exists! Sign in instead." };

    const cookie = createCookie();
    const hex = getHex(cookie);
    const uuid = v4();
    const safePass = bcrypt.hash(password, 11);
    let safeSD = null; ///safeSiteData

    if (site && cron) {
      safeSD = {
        site: safeSite(site),
        cron: safeCron(cron),
        ...(range?.end > 1 ? { range } : {}),
        active: true,
      };
    }
    if (safeSD.cron && safeSD.site) {
      await db`insert into "private"."users" (username, password, uuid, sites) values (${username}, ${safePass}, ${uuid}, array['${safeSD}'::jsonb]) `;
      await db`insert into "private"."sessions" (uuid, "sessionId") values (${uuid}, ${hex}) `;
    }

    return { cookie, safeSD };
    // const scheduled = await scheduleShot({ cronData: s, env, cookie });
  } catch (e) {
    console.error("Error in createUser: ", e);
    return { error: "Couldn't create user. " + e.error };
  }
}

export async function deleteUser(user, attempt) {
  try {
    let attemptReady = false;
    if (attempt) {
      const lastMonth = new Date(Date.now() - 28 * 24 * 3600 * 1000);
      await db`update "private"."users" set "deletionAttempt" = (case when "deletionAttempt" is not null then "deletionAttempt" else now() end) where username = ${user} returning "deletionAttempt"`;
      if (r1[0].deletionAttempt < lastMonth) attemptReady = true;
    } else if (!attempt || attemptReady) {
      const c = await db`select count(*) from "public".${db(user)}`;
      await db`drop table "public".${db(user)}`;
      await db`insert into "private"."deleted_users" (username, shots_taken) values (${user}, ${c[0]?.count})`;
      await db`delete from "private"."users" where user = ${user}`;
    }
    return { error: null };
  } catch (e) {
    console.error("Error in deleteUser: ", e);
    return { error: "Couldn't delete user." };
  }
}

// async function getUserSites({cookie}) {
//   //validate session first!
//   try{
//     const hex = getHex(cookie);
//     const res =
//     await db`select u.sites, u.username as user from "private"."sessions" inner join "private"."users" u on uuid = u.uuid where "sessionId" = ${hex}`;
//     if (!res[0]) throw { error: "No sites found" };
//     const {sites, username }= res[0].sites; //{cron: "", site: "", range: {start,end}}[];
//     const username = res[0].username;
//     return { sites, username, error: "" };
//   }catch(e){
//   }
// }

async function getUserTable({ user, env }) {
  //validate session first!
  if (!db && env) DB(env.DB_CONN);
  if (!db) throw { error: "getUserTable's db uninitialised" };
  const r1 =
    await db`select table_name as t from information_schema.tables where table_schema = "public" and table_name = ${user}`;
  const r2 =
    await db`select sites from "private"."user" where username = ${user}`;
  return { tableName: r1[0]?.t, prevSites: r2[0]?.sites };
}

export async function destroyCron(cookie, env, cron) {
  //Can only keep shots for a day or two -- due to database constraints
  //cancel crons for users not logged for 3 months

  const res = await db`delete from "private"."users" `;
}

// helper functions

export async function setNotification({ message, danger, user, del }) {
  try {
    const now = new Date();
    if (!message) throw { error: "Empty message." };
    if (del)
      await db`update "private"."users" set notifications = array(select n from unnest(notifications) as n where n ->> 'message' = ${message}) where username = ${user}`;
    else {
      const noti = { now, message, danger: danger ? true : false };
      await db`update "private"."users" set notifications = array_append(notifications, '${noti}'::jsonb) where username = ${user}`;
    }

    return { error: null };
  } catch (e) {
    console.error("Error in setNotification. ", e);
    return { error: "Couldn't set notification. " + e.error };
  }
}

export function safeSite(site, noDots) {
  try {
    console.log(`in safeSite. site: ${site}`);
    if (!site) throw { error: "No site provided" };
    if (!site.startsWith("http")) site = "https://" + site;
    console.log(`in safeSite. site after 'http' embed: ${site}`);
    const s = new URL(site);
    const domain = s?.hostname.replace("www.", "");
    let ss = domain + (s?.pathname == "/" ? "" : s?.pathname);
    if (noDots) ss = ss.replace(/[^a-z0-9_]/gi, "_");
    ss = ss.replace(/^https?:\/\//, "");
    console.log(`in safeSite. site after http | noDot: ${site}`);
    return ss;
  } catch (e) {
    console.error("Safesite error: ", e);
    return null;
  }
}

export function safeCron(cron) {
  try {
    // const validCron = cron.match(/^(\*|\*\/\d+|\d+)\s(\*|\*\/\d+|\d+)\s(\*|\*\/\d+|\d+)\s(\*|\*\/\d+|\d+)\s(\*|\*\/\d+|\d+)$/)
    const validCron = cron.match(/^((\*|\*\/\d+|\d+)\s){4}(\*|\*\/\d+|\d+)$/);
    if (!validCron) throw { error: "invalid cron" };
    return validCron[0];
  } catch (e) {
    console.error("Safecron error: ", e);
    return null;
  }
}

export function safeRange(range) {
  if ("start" in range && range?.end && Object.entries(range)?.length == 2)
    return true;
  else;
}

function createCookie() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return encodeBase32LowerCaseNoPadding(bytes);
}

function getHex(cookie) {
  if (!cookie) throw { error: "No cookie provided" };
  return encodeHexLowerCase(sha256(new TextEncoder().encode(cookie)));
}
