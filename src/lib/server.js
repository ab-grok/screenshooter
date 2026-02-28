//Critical error messages: log should be sent to log table using setNotifications.  -- do this
//Remove env arg from all instances -- now fetches from api
//Send error logs to settings table not ADMIN

"use server";

import bcrypt from "bcryptjs";
import postgres, { Sql } from "postgres";
import { v4, validate } from "uuid";
import { shot, downloadShot } from "./types";
import { getCookie } from "./actions";
import { formatDate } from "./dateformatter";

function DB(conn) {
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

const db = DB(process.env.DB_CONN);
// let db: Sql<{}> = DB(process.env.DB_CONN);

//------> shooterWorker actions
export async function makeEntry({ shotData }) {
  //Id used for removing `failed shot` notifications.
  //sets prevId as fileData when duplicate is found.
  try {
    if (!db) throw { error: `Db uninitialised!` };

    const dateStr = formatDate(new Date());

    const { site, shot, range, html, user, id } = shotData;
    if (!shot || !html || !user || !site) throw { error: "Missing params" };

    const sS = safeSite(site, "noDots");
    const u = db(user);

    if (!sS) {
      console.error("in makeEntry site unsafe: ", site, " user: ", user);
    } else {
      const fileName = sS + "_" + dateStr;
      const fileType = "image/jpeg";
      const fileData = shot;
      const shotCol = db(sS + "_shot");
      const htmlCol = db(sS + "_html");

      //columns should exist - created in updateShotSchema
      const htmlData = { html, range };
      const prevId = await entryExists({ htmlData, user });
      const updHtml = prevId ? prevId : html;

      const shotData = prevId
        ? { fileName, fileData: prevId, fileType: "plain/text" }
        : { fileName, fileData, fileType };

      const r1 =
        await db`insert into "public".${u} (${shotCol}, ${htmlCol}) values (${shotData}, ${updHtml}) returning id`;

      if (r1?.[0].id) {
        //remove "failed attempt" notification -- set when retrieving the sites
        const msgData = { id };
        const noti = { msgData, user, del: true };
        const { error } = await setNotification({ ...noti });
        if (error) throw { error };
      }
    }
    return { error: null };
  } catch (e) {
    console.error(`Error in makeEntry: `, e);

    const msgData = { msg: JSON.stringify(e), danger: true };
    const noti = { msgData, user };
    await setNotification({ ...noti });
    return { error: "Error in makeEntry" };
  }
}

async function entryExists({ htmlData, user }) {
  try {
    //checks if the selected part of a new shot matches a previous entry.
    //start e: 1477865/1609938, c: 1664160/1663495 -- end e: 1693003 / 1820704  c: 1868906 / 1922007 / 1894144
    if (!db) throw { error: "Db uninitialised!" };

    const { html, range } = htmlData;
    if (!html) throw { error: `Missing parameters` };

    let partHtml = html;
    if (safeRange(range)) {
      const { start, end } = range;
      partHtml = html.slice(start, end);
    }

    partHtml = db`%${partHtml}%`;
    const u = db(user);

    const r1 =
      await db`select id from "public".${u} where date > now() - 1 day and html like ${partHtml} order by date desc limit 1`;

    if (r1?.[0]?.id) return r1[0].id;

    return null;
  } catch (e) {
    console.error("error in entryExists. ", e);
    return null;
  }
}

export async function delPrevEntry({ cron, site, user }) {
  // from worker -- run before setting shot. need this to free up space.
  try {
    if (!user || !cron || !site) throw { error: `Missing params.` };

    const r1 =
      await db`select "storeDuration" from "private"."users" where username = ${user}`;
    const sD = r1?.[0]?.storeDuration || 1;

    const storeLimit = new Date();
    storeLimit.setDate(storeLimit.getDate() - sD);

    const htmlCol = db(`${safeSite(site, "_")}_html`);
    const u = db(user);

    const r2 =
      await db`delete from "public".${u} where ${htmlCol} is not null and date < ${storeLimit} `;

    return { error: null };
  } catch (e) {
    const params = { msg: "error in delPrevEntry", e, cron, site, user };
    console.error("error in delPrevEntry", e, params);
    return { error: { ...params } };
  }
}

export async function getCronSites(cron) {
  //called from worker -- gets readySites (readyUsers), runs cleanup for crons whose users lastLog > 3mos.
  //currently Checking for if it gets userSites that I can check (in updateUserSites) for active prop and validate maxCrons.
  try {
    if (!db) throw { error: "Db uninitialised" };

    const readySites = [];

    const r1 =
      await db`select "cronData" as "cD" from "private"."crons" where cron = ${cron}`;
    const r1a = r1[0]?.cD;

    if (!r1a || (r1a.length == 1 && !r1a[0])) {
      const e1 = "in getCronSites. Cron not found. Running cleanup...";
      console.error({ error: e1 });

      await db`delete from "private"."crons" where cron = ${cron}`;

      const updW = { user: "cleanUp", cron, del: true };
      const { error } = await updateWorker({ ...updW });
      if (error) throw { error };

      console.log("in getCronSites. Cron cleaned!");
      return { error: null };
    }

    for (const { site, range, user } of r1a) {
      let staleTime = new Date();
      staleTime.setMonth(staleTime.getMonth() - 3);

      //for lastLog you must not delete session record when logging out -- simply set sessionId = null
      const r2 =
        await db`select s."lastLog" from "private"."users" inner join "private"."sessions" s on uuid = s.uuid where username = ${user} `;
      const lastLog = r2[0]?.lastLog;

      console.log("in getCronSites. lastLog: ", lastLog);

      if (staleTime > lastLog || !lastLog) {
        const msg =
          "In getCronSites. User unlogged past 3 months. Removing cron and prevEntries";
        console.log(msg, `lastLog: ${lastLog}`);

        const safeSD = { site, cron, range };
        const updCron = { safeSD, user, del: true };

        const { error: e1 } = await delPrevEntry({ cron, site, user });

        const { error: e2 } = await setSiteInactive({ site, cron, user });
        const { delWorker, error: e3 } = await updateCronTable({ ...updCron });

        if (delWorker) {
          const { error: e4 } = await updateWorker({ ...updCron });
          if (e1 || e2 || e3 || e4) throw { error: e1, ...{ e2, e3, e4 } };
        }
        continue;
      }
      readySites.push({ user, site, range });
    }
    //Accounting for worker timeout scenario -- users get notified of attempt using same notification 'id', this is later removed on successful write.
    const msg = `${cron} fired. But shot failed to save`;
    const user = readySites.map((s) => s.user);
    const msgData = { msg, danger: true };
    const { id } = await setNotification({ msgData, user });

    return { readySites, id };
  } catch (e) {
    console.error("error in getCronSites! ", e);
    return { error: e };
  }
}

//-------------------------------------------------------------------------------> client actions

// /**
//  * @typedef {Object} file
//  * @property {string} fileName
//  * @property {string} fileData
//  * @property {string} fileType
//  */
// /**
//  * @typedef {Object} shot
//  * @property {string} html
//  * @property {file} file
//  * @property {Date} date
//  * @property {number} id
//  * @property {boolean} viewed
//  */
/**
 * @param {{site: string, user: string, id: number, next?:boolean}} shotSet
 * @returns {Promise<{error: string, nextCursor: number, prevCursor:
 * number, noMoreNext: boolean, noMorePrev: boolean, shots: shot[]}>}
 */

export async function getUserShots(shotSet) {
  //gets usersite html and screenshot data
  //noMoreNext/Prev: returns true when the retrieved set is less than the limit.
  // shotSet: indicates the current position and scroll direction for retrieving entries.
  try {
    const { site, id, next: n, user } = shotSet;

    const res =
      await db`select sites from "private"."users" where username = ${user} `;

    if (!res?.[0]?.sites || res[0]?.sites?.length == 0)
      throw { error: "User has no sites" };

    const saferSite = safeSite(site, "noDots");
    const sS = safeSite(site);
    const hC = db(`${saferSite}_html`);
    const sC = db(`${saferSite}_shot`);
    const u = db(user);
    let nextCursor, prevCursor, noMoreNext, noMorePrev;

    const thisSite = res[0].sites.find((s) => s.site == sS);
    if (!thisSite) throw { error: `Site not found. shotSet.site: ${site}` };

    const clause = id ? db`id ${n ? db`>` : db`<`} ${id}` : db`viewed = false`;

    const shots =
      await db`select ${hC} as html, ${sC} as file, date, viewed, id from "public".${u} where html is not null and ${clause} order by id asc limit 20`;

    if (shots[0]) {
      const viewIds = shots.map((s) => s.id);

      nextCursor = viewIds.at(-1);
      prevCursor = viewIds.at(0);
      noMoreNext = next && viewIds.length < 20;
      noMorePrev = !next && viewIds.length < 20;
    } else throw { error: "No rows in user table! " };

    return { nextCursor, prevCursor, noMoreNext, noMorePrev, shots };
  } catch (e) {
    console.error("Error in getUserShots: ", e);
    return { error: "Couldn't get userShots " + e.error };
  }
}

/**
 * @param {{site: string, id: number, next?:boolean}} shotSet
 * @returns {Promise<{error: string, nextCursor: number, prevCursor:
 * number, noMoreNext: boolean, noMorePrev: boolean, shots:shot[]}>}
 */

export async function getVisitorShots(shotSet) {
  //check if VSITE, VTB vars are set.
  //Create a user "visitor" with a table and site: cnn -- check same site in takeShot to get both in one go.
  try {
    const { id, next } = shotSet;

    const saferSite = safeSite(process.env.VSITE, "noDots");
    const vShot = db(`${saferSite}_shot`);
    const vHtml = db(`${saferSite}_html`);
    const vtb = db(process.env.VTB);
    let nextCursor, prevCursor, noMoreNext, noMorePrev;

    const clause = id
      ? db`id ${next ? db`>` : db`<`} ${id}`
      : db`viewed = false`;

    const shots =
      await db`select id, ${vShot} as file, ${vHtml} as html, date, viewed from "public".${vtb} where html is not null and ${clause} order by id asc limit 20 `;

    if (shots[0]) {
      const viewIds = shots.map((s) => s.id);

      nextCursor = viewIds.at(-1);
      prevCursor = viewIds.at(0);
      noMoreNext = next && viewIds.length < 20;
      noMorePrev = !next && viewIds.length < 20;
    } else throw { error: "Visitor table returned no rows!" };

    return { nextCursor, prevCursor, noMoreNext, noMorePrev, shots };
  } catch (e) {
    console.error("Error in getVisitorShots. ", e);
    return { error: "Couldn't get visitor shots. " + e.error };
  }
}

//here I get shots from db -- each shot contains a jpeg of about 3MB I reckon (full screenshot of website), and corresponding HTML. So How many shots do you reckon I can pass in the server action before it breaks vercel free tier limits?
/**
 *
 * @param {{unviewed?: boolean; user?: string, site?: string, id?: number, next?:boolean}} params
 * @returns {Promise<{error?: string; downloadShots: Omit<shot, "viewed">[] }>}
 */
export async function getDownloadShots({ site, user, unviewed, id, next }) {
  //id would be used to get shots before or after id; Can set up incremental downloads for large batch (set limit);
  //expects either unviewed or id to get shots.

  try {
    const u = user && site ? true : false;

    const saferSite = safeSite(u ? site : process.env.VSITE, "noDots");
    const html_col = db(saferSite + "_html");
    const shot_col = db(saferSite + "_shot");
    const tb = db(u ? user : process.env.VTB);

    const clause = unviewed
      ? db`viewed = false`
      : id
        ? next
          ? db`id > ${id}`
          : db`id < ${id}`
        : "";

    if (!clause) throw { error: "missing params" };

    const downloadShots =
      await db`select id, ${shot_col} as file, ${html_col} as html, date from public.${tb} where html is not null and ${clause}`;
    if (!downloadShots[0]) throw { error: "No rows in user's table!" };

    return {
      downloadShots,
    };
  } catch (e) {
    console.error("In getDownloadShots: ", e);
    return { error: "In getDownloadShots: ", e };
  }
}

export async function deleteShot({ ids, user }) {
  //can send an array of shot IDs
  try {
    ids = isArray(ids) ? ids : [ids];
    const u = db(user);
    const r1 = await db`delete from "public".${u} where id = any(${ids})`;
    return { error: null };
  } catch (e) {
    console.error("Error in deleteShot: ", e);
    return { error: "Could not delete shot" };
  }
}

export async function setShotViewed({ site, ids, user }) {
  //call from frontend when user opens unviewed images
  // sets viewed in user's table to true: ids: [] -- will call per opened shot or selectedShots.

  try {
    if (!user || !site || !ids) throw { message: "Missing parameters" };

    const u = db(user);
    await db`update "private".${u} set viewed = true where site = ${site} and id = any(${ids})`;

    return { error: null };
  } catch (e) {
    console.error("error in setEntryViewed: ", e);
    return { error: "couldn't setEntryViewed: " + e.message };
  }
}

export async function countUnviewedShots(user) {
  //unviewed: {site, count}
  //Gets the number of unseen shots per site
  try {
    const { tableName, userSites } = await getUserSites({ user });
    if (!userSites) throw { error: "User has no sites" };
    const u = db(tableName);

    const allUnvieweds = await Promise.all(
      userSites.map(async (s) => {
        try {
          const r1 =
            await db`select count(*) from "public".${u} where site = ${s.site} and viewed = false`;
          return { site: s.site, unvieweds: r1[0].count };
        } catch (e) {
          console.error("Error in countUnviewedShots userSites map: ", e);
          return { site: s.site, unvieweds: 0 };
        }
      }),
    );
    return { allUnvieweds };
  } catch (e) {
    console.error("Error in countUnviewedShots. ", e);
    return { error: "Could not get unviewed shots. " + e.error };
  }
}

//------------------------------------------------------------------------> cron scheduling

export async function updateShotSchema({ site, user, del }) {
  //creates a table for user in root db with default cols. Can also delete site cols
  try {
    const saferSite = safeSite(site, "noDots");
    if (!saferSite) throw { error: "Invalid site" };
    const { tableName, userSites } = await getUserSites({ user });

    const u = db(user);
    const htmlCol = db(saferSite + "_html");
    const shotCol = db(saferSite + "_shot");

    if (!tableName) {
      if (del)
        await db`create table "public".${u} (id serial primary key, date timestamptz default now())`;
      else
        await db`create table "public".${u} (id serial primary key, date timestamptz default now(), viewed boolean default false, ${htmlCol} text, ${shotCol} jsonb)`;
    } else {
      if (del)
        await db`alter table "public".${u} drop column ${htmlCol}, drop column ${shotCol}`;
      else
        await db`alter table "public".${u} add column if not exists viewed boolean default false, add column if not exists ${htmlCol} text, add column if not exists ${shotCol} jsonb`;
    }
    return { user, saferSite, userSites };
  } catch (e) {
    console.error("error in updateShotSchema: ", e);
    return { error: "Couldn't create  ShotSchema. " + e.error };
  }
}

export async function updateUserSites({ safeSD, user, del, re }) {
  try {
    //re: reactivate.
    //Takes upd data: safeSD, merges with existing data: userSites, and updates "users" table.
    //created getActiveSites() which checks that a new/re site is below the maxCrons limit and can be added.

    const { cron, site, range: sR } = safeSD;

    if (del) {
      await db`update "private"."users" set sites = array(select s from unnest(sites) as s where s ->> 'site' != ${site} ) where username = ${user}`;
      console.log(`in updateUserSites. {Site: ${site}, cron: ${cron}} removed`);
    } else {
      const { userSites } = await getUserSites({ user });
      const { canAddSite, maxCrons, activeSites } = await getActiveSites(user);

      if (userSites?.[0]) {
        const tS = userSites.find((p) => p.site == site) || {};

        if (!tS && !canAddSite) {
          const content = { maxCrons, activeSites };
          throw { message: "Unable to add new site to exising sites", content };
        }

        let updSite = {};

        const { start: a, end: b } = tS?.range ?? {};
        const rangeChange = sR && (sR?.end != b || sR?.start != a);

        //will pass for updates, reactivation or new sites addition
        if (cron != tS?.cron || rangeChange || re) {
          updSite = {
            site,
            ...(cron != tS?.cron ? { cron } : {}),
            ...(sR && (sR?.end != b || sR.start != a) ? { range: sR } : {}),
            ...(canAddSite && (!tS || re) ? { active: true } : {}), //only set active:true when it's a new site or reactivating
          };

          //need to set active=true when:
          //A: tS (site exists) -- nope (is update)
          //B: !ts (new site) -- yes if canAddSite
          //C: re (tS)  -- yes if canAddSite
          updSite = { ...tS, ...updSite };
          const sitesArr = [
            ...userSites.filter((p) => p.site != site),
            updSite,
          ];

          await db`update "private"."users" set sites = ${sitesArr}::jsonb[] where username = ${user}`;
        } else {
          const msg = "No change to existing cronData. Did not update.";
          console.log("In updateUserSites: ", msg, { site, cron });
        }
      } else if (canAddCron) {
        const updSite = { cron, site, range: sR, active: true };
        await db`update "private"."users" set sites = array[${updSite}::jsonb] where username = ${user}`;
      } else {
        const content = { maxCrons, activeSites };
        throw { message: "Unable to add new site ", content };
      }
    }
    console.log("in updateUserSites. User's siteData has been changed.");
    return { error: null };
  } catch (e) {
    console.error("Error in updateUserSites: ", e);
    return { error: "Couldn't update user sites: " + e.message || "" };
  }
}

export async function updateCronTable({ safeSD, user, del }) {
  //Tb structure: cron -> string | cronData -> [{cron, user, range}]
  //For mass delete cronData on staleCron:  Less compute cost per invocation with calling this per site than setting all userSites to inactive in one go -- as cronTable will require whole table search/update for Locating cronData accross crons
  //if insert, Call after updateUserSites -- cause that check user's maxCrons potentially throwing an error this depends on

  //canAddCron tracks max crons the app can cater to -- 5 right now
  // safeSD: [{cron, site, range}];
  //returns: delWorker: true indicates to run del on updWorker().
  //check that users get MaxCron = 1 on user creation.

  try {
    const { cron, site, range } = safeSD;
    const cronData = { user, site, ...(range ? { range } : {}) };

    const r1 = await db`select count(cron) from "private"."crons"`; //for cron length

    if (r1[0]) {
      const r2 =
        await db`select cron from "private"."crons" where cron = ${cron}`; // for cron availability

      const sameCron = r2[0]?.cron;

      const r4 =
        await db`select "maxCrons" from "private"."settings" where id = 1`;

      const canAddCrons = r1[0].count ?? 0 < r4[0]?.maxCrons ?? 5;

      if (!sameCron) {
        if (del) throw { error: "Cron does not exist!" };
        if (!canAddCrons)
          //this means a potential new site can't get a cron schedule -- must set site to inactive
          throw { error: "app maxCrons reached." };

        await db`insert into "private"."crons" (cron, "cronData") values (${cron}, array[${cronData}::jsonb])`;
      } else if (del) {
        const r6 =
          await db`update "private"."crons" set "cronData" = array(select c from unnest("cronData") as c where not (c ->> 'site' = ${site} and c ->> 'user' = ${user})) where cron = ${cron} returning "cronData"`;
        const r6a = r6[0]?.cronData;

        if (!r6a || !r6a?.length || (r6a?.length == 1 && r6a?.[0] == null)) {
          await db`delete from "private"."crons" where cron = ${cron}`;
          return { delWorker: true, error: null };
        }
      } //Cron exists and directive is not delete -- check that user site is included in cron array else delete
      else
        await db`update "private"."crons" set "cronData" = case when exists (select 1 from unnest("cronData") as c where c ->> 'site' = ${site} and c ->> 'user' = ${user}) then "cronData" else array_append( "cronData", ${cronData}::jsonb ) end where cron = ${cron}`;
    } else {
      if (del) throw { error: "No crons found!" };
      console.log("in updateCronTable. No crons found. Inserting first cron");
      await db`insert into "private"."crons" (cron, "cronData") values (${cron}, array[${cronData}::jsonb])`;
    }
    return { delWorker: false, error: null };
  } catch (e) {
    //if adding cron -- (!del): then set userSite.inactive -- del presumes userSites.del has already been called
    const e0 = "In updateCronTable. Couldn't add cron to table.";
    const e1 = e0 + !del ? "Setting site to inactive" : "";

    const log = `${e1} ${JSON.stringify({ user, error: e })}`;
    console.error(log);

    if (!del) await setSiteInactive({ ...safeSD });
    return { error: e0 + e.error };
  }
}

export async function updateWorker({ safeSD, user, del }) {
  try {
    //in future can do better schedule organisation: selecting high order schedules and probing db for fitting crons; -- can take any cron check cron list for matching pattern eg a cron for /30mins and preexisting /10mins can share execute
    const { cron, site } = safeSD;

    const shooterUrl = process.env.SHOOTER_URL;
    const shooterKey = process.env.SHOOTER_KEY;
    console.log("in UpdateWorker. ", { shooterUrl, shooterKey });
    if (!shooterKey || !shooterUrl) throw { error: "Setting env vars failed!" };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${shooterKey}`,
    };

    const r1 = await fetch(shooterUrl + "/schedules", {
      headers,
    });
    const worker = await r1?.json();

    if (!r1.ok) {
      const error = "ShooterWorker API fetch failed: ";
      throw { error, content: worker?.error };
    }

    console.log("ShooterWorker API fetch success: ", { cron, worker });
    const prevCrons = worker.result?.schedules || []; //{cron: "* * *"}[]
    const thisCron = prevCrons.find((s) => s.cron == cron);
    let updCrons = null;

    if (thisCron) {
      if (!del) {
        console.error("Tried adding an existing cron!");
        return { error: null };
      }
      updCrons = prevCrons.filter((s) => s.cron != cron);
    } else {
      if (del) {
        console.error("A nonexisting cron was deleted!");
        return { error: null };
      }

      //Checking maxCrons limit before inserting cron -- should be safe after updateCronSites (only context where I'm adding crons)-- but check anyway
      const r2 =
        await db`select "maxCrons" from "private"."settings" where id = 1`;

      const canAddCron = prevCrons.length ?? 0 < r2[0]?.maxCrons ?? 5;
      if (!canAddCron) throw { error: "worker maxCrons reached." };

      updCrons = [...prevCrons, { cron }];
    }

    const r3 = await fetch(shooterUrl + "/schedules", {
      method: "PUT",
      headers,
      body: JSON.stringify(updCrons),
    });

    const r3a = await r3?.json();
    if (!r3.ok)
      throw { error: "ShooterWorker PUT failed", content: r3a?.errors };

    console.log("in updateWorker. added new cron to existing crons. ");
    return { error: null };
  } catch (e) {
    const e0 = `Error updating worker. `;
    const e1 = e0 + !del ? "Setting inactive and removing from cronTable" : "";
    const log = `${e1} ${JSON.stringify({ user, error: e })}`;
    console.error(log);

    if (!del) {
      await updateCronTable({ safeSD, user, del: true });
      await setSiteInactive({ ...safeSD });
    }

    return { error: e0 + e.error };
  }
}

//-------> User control
export async function checkUser({ username, password }) {
  //uid is defined only when the pass is matched
  try {
    if (!username) throw { error: "Missing credentials" };
    const r =
      await db`select username as user, password as pass, uuid, s."sessionId" as "sid" from "private"."users" left join "private"."sessions" s on uuid = s.uuid where username = ${username}`;
    if (!r.length) throw { error: "User does not exist" };

    const samePass = await bcrypt.compare(password, r[0].pass);
    if (samePass) return { user: r[0].user, sid: r[0].sid, uid: r[0].uuid };
    else return { user: r[0].user };
  } catch (e) {
    console.error("Error in checkUser: ", e);
    return { error: e.error || "Couldn't confirm user." };
  }
}

export async function createUser({ userPass, safeSD }) {
  //creates a record for new user in user table, optionally adding shot if included.
  try {
    const { username, password } = userPass;
    if (!username || !password) throw { error: "Missing parameters" };

    const { user } = await checkUser({ username, password });
    if (user) throw { error: "User Exists! Sign in instead." };

    const cookie = createCookie();
    const token = getToken(cookie);
    const uuid = v4();
    const safePass = await bcrypt.hash(password, 11);

    safeSD && (safeSD = { ...safeSD, active: true });

    const sCol = safeSD ? db`, sites` : db``;
    const sVal = safeSD ? db`, array(${safeSD}::jsonb)` : db``;

    await db`insert into "private"."users" (username, password, uuid ${sCol}) values (${username}, ${safePass}, ${uuid} ${sVal} ) `;
    await db`insert into "private"."sessions" (uuid, "sessionId") values (${uuid}, ${base64}) `;

    return { cookie, safeSD };
  } catch (e) {
    console.error("Error in createUser: ", e);
    return { error: "Couldn't create user. " + e.error };
  }
}

export async function deleteUser(user, delPass) {
  //deletes
  try {
    let delReady = false;
    let deletionDue;

    if (!delPass) {
      const nextMonth = new Date(Date.now() + 28 * 24 * 3600 * 1000);
      // await db`update "private"."users" set "deletionAttempt" = (case when "deletionAttempt" is not null then "deletionAttempt" else ${nextMonth} end) where username = ${user} returning "deletionAttempt"`;
      const msg = `An attempt at deleting your account was made, and it will be possible on ${nextMonth.toLocaleString()} with or without your password. To prevent this, simply delete this notification or uncheck \"Delete Account anyway\" in profile.`;

      const r1 =
        await db`update "private"."users" set "deletionAttempt" = (case when "deletionAttempt" ->> 'message' is not null then "deletionAttempt" else jsonb_build_object('dueDate', ${nextMonth}, 'message', ${msg} )  ) where username = ${user} returning "deletionAttempt"`;
      //hope this works when there is no 'message' key in deletion attampw
      deletionDue = r1?.[0]?.deletionAttempt;
      if (new Date(deletionDue) < new Date()) delReady = true;
    }

    if (delPass || delReady) {
      const c = await db`select count(*) from "public".${db(user)}`;
      await db`insert into "private"."deletedUsers" (username, shotsTaken) values (${user}, ${c[0]?.count})`;
      await db`delete from "private"."users" where username = ${user}`;
      await db`drop table "public".${db(user)}`;
      return { deletionDue, deleted: true };
    }
    return { deletionDue, deleted: false };
  } catch (e) {
    console.error("Error in deleteUser: ", e);
    return { error: "Couldn't delete user." };
  }
}

export async function undeleteUser(user) {
  try {
    const r1 =
      await db`update "private"."users" set "deletionAttempt" = null where username name = ${user}`;
    return { error: null };
  } catch (e) {
    return { error: "Trouble undoing Account deletion!" };
  }
}

/**
 *
 * @param {*} param0
 * @returns {Promise<{tableName?: string, userSites?: any[], maxCrons?: number, error?: string}>}
 */
export async function getUserSites({ user }) {
  //validate session first!
  //userSites: {site, cron, range}[]
  try {
    if (!db) throw { error: "Db uninitialised!" };
    if (!user) throw { error: "Unknown user!" };

    const r1 =
      await db`select table_name as t from information_schema.tables where table_schema = 'public' and table_name = ${user}`;
    const r2 =
      await db`select sites, "maxCrons" from "private"."user" where username = ${user}`;

    const siteData = { tableName: r1[0]?.t, userSites: r2[0]?.sites };
    return { ...siteData, maxCrons: r2[0]?.maxCrons };
  } catch (e) {
    console.error(`Error in getUserSites: `, e);
    return { error: `Error in getUserSites: ${JSON.stringify(e)}` };
  }
}

export async function getActiveSites(user) {
  //for this, set active: true on all new site/cron addition
  try {
    const { userSites, maxCrons } = await getUserSites({ user });
    if (!maxCrons)
      throw { message: 'Critical error: user\'s "maxCrons" missing.' };

    const activeSites = userSites?.filter((p) => p.active == true).length;
    const canAddSite = activeSites < maxCrons;

    return { canAddSite, maxCrons, activeSites };
  } catch (e) {
    console.error("in checkActiveSites: ", e);
    return { canAddSite: false, maxCrons: 0, activeSites: 0 };
  }
}

export async function setSiteInactive({ site, cron, user }) {
  try {
    if (!site || !cron) throw { message: "Invalid parameters" };

    if (!db) throw { error: "Db uninitialized!" };

    const r2 =
      await db`update "private"."users" set sites = array( select (case when s ->> 'site' = ${site} and s ->> 'cron' = ${cron} then jsonb_set(s, '{active}', false ) else s end ) from unnest(sites) as s ) where username = ${user}`;

    return { error: null };
  } catch (e) {
    console.error("Problem in setSiteInactive: ", e);
    return { error: "Couldn't set siteInactive." };
  }
}

// -------------> helper functions

/**
 * @typedef {{id?:number, date?:Date, msg:string, danger?:boolean}} msgData
 */
/**
 * @param {{msgData: msgData, user?:string, del?:boolean, postAdmin?:boolean }} msgData
 * @returns {Promise<{id: number, error: string}>}
 */
export async function setNotification({ msgData, user, del, postAdmin }) {
  //msgData: {id?, msg, danger};
  //sets notification enmass for users (user[]) or just 1 (user); sets to admin account when postAdmin = true;
  //used in setNotifyEntry: called once on getting ready users, and then later for each user when shot added.
  //uses same id even for an array of users, but non unique id doesn't pose a problem as it is used in isolated user context.

  try {
    if (!db) throw { error: "Db uninitialised" };

    function ID() {
      return Math.floor(100000 + Math.random() * 900000);
    }

    const { id: i, date: d, msg, danger } = msgData;

    const message = msg?.trim();
    if ((!message && !del) || !user || (del && !i))
      throw { error: "Missing parameters" };

    const u = Array.isArray(user) ? user : [user];
    const id = i || ID();
    const date = d || new Date();
    const noti = { id, date, message, danger };

    if (!del) {
      u[0] &&
        (await db`update "private"."users" set notifications = array_append(notifications, ${noti}::jsonb ) where username = any(${u})`);
      postAdmin &&
        (await db`update "private"."settings" set "adminNotifications" = array_append("adminNotifications", ${noti}::jsonb) where id = 1;`);
    } else {
      u[0] &&
        (await db`update "private"."users" set notifications = array(select n from unnest(notifications) as n where n ->> 'id' != ${id}) where username = any(${u}) `);
      postAdmin &&
        (await db`update "private"."settings" set "adminNotifications" = array( select a from unnest("adminNotifications") as a where a ->> 'id' != ${id})`);
    }

    return { id };
  } catch (e) {
    console.error("Error in notifyEntry: ", e);
    return { error: "Could not set notification. " + e.error };
  }
}

export function safeSite(site, noDots) {
  try {
    console.log(`in safeSite. site: ${site}`);
    site = site.trim();
    if (!site) throw { error: "No site provided" };
    if (!site.startsWith("http")) site = "https://" + site;
    console.log(`in safeSite. site after 'http' embed: ${site}`);

    const s = new URL(site);
    if (!s) throw { error: "Couldn't parse URL" };
    const domain = s.hostname.replace("www.", "");
    const pathname = s.pathname.endsWith("/")
      ? s.pathname.substring(0, -1)
      : s.pathname;

    let ss = domain + pathname;

    if (noDots) ss = ss.replace(/[^a-z0-9_]/gi, "_");
    ss = ss.replace(/^https?:\/\//, "");
    const isNoDot = noDots ? "NoDots " : "";
    console.log(`in safeSite. ${isNoDot}site after http removed: ${site}`);
    return ss;
  } catch (e) {
    console.error("Safesite error: ", e);
    return null;
  }
}

export function safeCron(cron) {
  try {
    //vaalidates crons based on a format (reduced from normal cF cron templates)
    //invalid crons: 'd,d/d' (list step), 'd-d,d' (ranged list)
    // const validCron1 = /^(?:\*|\*\/\d+|\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)(?:\s+$(?:\*|\*\/\d+|\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)){4}$/;
    const validCron = cron
      .trim()
      .match(
        /^(((?:\*|\d+)(?:\/\d+)?|\d+((?:-\d+)?(?:,\d+(?:-\d+)?)+))\s+){4}((?:\*|\d+)(?:\/\d+)?|\d+((?:-\d+)?(?:,\d+(?:-\d+)?)+))$/,
      );
    if (!validCron) throw { error: "invalid cron" };
    return validCron[0];
  } catch (e) {
    console.error("Safecron error: ", e);
    return null;
  }
}

export function safeRange(range) {
  if ("start" in range && range?.end && Object.entries(range)?.length == 2)
    return range;
  else return null;
}

export function cronToText(cron) {
  try {
    //gets the text forms of the cronFields:cF. Functions iterateover the cFs appending fillers like "from", "every" depending on cF format
    const sC = safeCron(cron);
    if (!sC) return { error: null };
    const [mm, hh, DD, MM, WW] = sC.trim().split(/\s+/);
    const mmText = cronFieldText(mm, "minute");
    const hhText = cronFieldText(hh, "hour");
    const DDText = cronFieldText(DD, "day");
    const MMText = cronFieldText(MM, "month");
    const WWText = cronFieldText(WW, "weekday");

    const parts = [mmText, hhText, DDText, WWText, MMText];
    const text = parts.join(" - ");
    return text;
  } catch (e) {
    console.error("Error in cronToText: ", e);
    return "";
  }

  function cronFieldText(cronField, timeUnit) {
    if (cronField.includes("/")) {
      const [base, step] = cronField.split("/");

      switch (base) {
        case "*":
          return `every ${step} ${timeUnit}s `;

        case base.includes(","):
          let dArr = [];
          cronField.split(",").forEach((d, i) => {
            if (d.includes("-")) {
              const tSpan = timeSpan(timeUnit, d.split("-"));
              dArr.push(`${i == 0 ? "from" : ""} ${tSpan}`);
            } else dArr.push(`${i == 0 ? "on" : ""} ${timeSpan(timeUnit, d)}`);
          });

          return `every ${step} ${timeUnit}s ${dArr
            .slice(0, -1)
            .join(", ")} and ${dArr.at(-1)}`;

        case base.includes("-"):
          const tSpan = timeSpan(timeUnit, base.split("-"));
          return `every ${step} ${timeUnit}s from ${tSpan}`;

        default:
          return `every ${step} ${timeUnit}s starting ${timeSpan(
            timeUnit,
            base,
          )}`;
      }
    } else if (cronField.includes(",")) {
      const dArr = [];
      cronField.split(",").forEach((d, i) => {
        if (d.includes("-")) {
          dArr.push(timeSpan(timeUnit, d.split("-")));
        } else dArr.push(timeSpan(timeUnit, d));
      });

      const tSpan = dArr.slice(0, -1).join(", ");
      return `on ${timeUnit}s ${tSpan} and ${dArr.at(-1)}`;
    } else if (cronField.includes("-")) {
      return `from ${timeUnit}s ${timeSpan(timeUnit, cronField.split("-"))}`;
    } else if (cronField == "*") return `every ${timeUnit}`;
    else if (!isNaN(cronField)) return `on ${timeUnit} ${cronField}`;
  }
}

function timeSpan(timeUnit, d) {
  //timeD: [time, d];
  const t = [];
  const d0 = Array.isArray(d) ? d : [d];
  for (const d of d0) {
    if (timeUnit == "weekday") t.push(timeText(d, null));
    else if (timeUnit == "month") t.push(timeText(null, d));
    else t.push(d);
  }

  const l2 = t.length == 2;
  return l2 ? `${t.join(" to ")}` : `${t[0]}`;

  function timeText(WW, MM) {
    const weekDay = {
      1: "sunday",
      2: "monday",
      3: "tuesday",
      4: "wednesday",
      5: "thursday",
      6: "friday",
      7: "saturday",
    };

    const month = {
      1: "jan",
      2: "feb",
      3: "mar",
      4: "apr",
      5: "may",
      6: "jun",
      7: "jul",
      8: "aug",
      9: "sep",
      10: "oct",
      11: "nov",
      12: "dec",
    };

    if (WW) return weekDay[WW] || WW;
    if (MM) return month[MM] || MM;
  }
}

//------------ User session
export async function createSession(password, username) {
  //call after validateSession -- which checks that a session is not active.
  try {
    if (!password || !username) throw { error: "Missing credentials" };

    const cookie = createCookie();
    const token = getToken(cookie);
    const { uid } = await checkUser({ username, password });
    if (uid)
      await db`update "private"."sessions" set "sessionId" = ${base64}, expires = now() where uuid = ${uid}`;
    else
      await db`insert into "private"."sessions" ("sessionId", uuid, expires) values (${base64}, ${uid}, now())`;

    return { cookie, error: "" };
  } catch (e) {
    console.error("Error in createSession: ", e);
    return { cookie: "", error: "Couldn't create session!" };
  }
}

/**
 * @param {{token: string, expires?: Date | null }} args
 * @returns {Promise<{ user: string, uid: string, error?: string }>}
 */

export async function getSession({ base64, expires }) {
  //Call with expires to update lastLog else it retrieves session. if (expires): absence of error indicates success;
  try {
    if (!base64) throw { error: "No base64 string" };

    let res;

    if (!expires) {
      res =
        await db`select u.username as user, uuid from "private"."sessions" inner join "private"."users" u on u.uuid = uuid where "sessionId" = ${base64}`;

      if (!res[0]) throw { error: "Unknown user" };

      console.log("Validated User: ", res);
    } else {
      await db`update "private"."sessions" set "lastLog" = now(), expires = ${expires} where "sessionId" = ${base64}`;
    }

    return { user: res?.[0]?.user || "", uid: res?.[0]?.uuid || "" };
  } catch (e) {
    console.error("Error in validateSession: ", e);
    return { error: "Trouble validating user! " + e.error };
  }
}

export async function deleteSession(base64) {
  try {
    if (!base64) throw { error: "Empty base64 string" };

    await db`update "private"."sessions" set "sessionId" = null where "sessionId" = ${base64}`;
    return { error: null };
  } catch (e) {
    console.error("in deleteSession. Error: ", e);
    return { error: "Something went wrong!" };
  }
}
