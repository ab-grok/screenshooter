"use server";
import { cookies } from "next/headers";
import {
  createSession,
  createUser,
  deleteSession,
  updateShotSchema,
  updateUserSites,
  updateWorker,
  safeCron,
  updateCronTable,
  checkUser,
  deleteUser,
  safeRange,
  setSiteInactive,
  undeleteUser,
  safeSite,
  getSession,
  getUserShots,
  getVisitorShots,
  getUserSites,
  setShotViewed,
  countUnviewedShots,
  deleteShot,
  getDownloadShots,
} from "./server";
import { delAccountRate, logRate, sessionRate } from "./redis.js";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import {
  delShotType,
  downloadProps,
  range,
  selectedShot,
  shot,
  shotData,
  userSites,
} from "./types";

//---> session managment
export async function getCookie(name: "session" | "analytics") {
  const cookie = (await cookies()).get(name)?.value;
  return cookie;
}

async function setCookie(
  name: "session" | "analytics",
  value: string,
  expires?: Date,
) {
  try {
    const cookie = (await cookies()).set(name, value, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: expires || new Date(Date.now() + 3600000 * 24 * 28),
    });
    return { error: null };
  } catch (e) {
    console.error("Error in setCookie. ", e);
    return { error: "Error setting cookie" };
  }
}

async function deleteCookie(name: "session" | "analytics") {
  const cookie = (await cookies()).delete(name);
}

export async function validateSession() {
  const cookie = await getCookie("session");
  if (!cookie) return { error: "Invalid session" };

  const token = getToken(cookie)!;

  const { user } = await getSession({ token });
  if (!user) return { error: "Unknown user" };

  //rateLimit is used to renew cookie expiration
  const { success } = await sessionRate.limit(`user:${user}`);

  //reset's expiry date to a month every 7 days from last active
  if (success) {
    const expires = new Date(Date.now() + 24 * 28 * 3600000);

    const { error: e1 } = await getSession({ token, expires });

    if (e1) console.error({ error: e1 });
    else await setCookie("session", cookie, expires);
  }
  return { user };
}

//--------> User Account Management
export async function logUser(username: string, password: string) {
  const { cookie, error } = await createSession(password, username);
  if (error) return { error };
  const { error: e2 } = await setCookie("session", cookie);
  if (e2) return { error: e2 };
}

export async function unLogUser() {
  const cookie = await getCookie("session");
  const token = getToken(cookie as string);

  const { error } = await deleteSession();
  await deleteCookie("session");
  return error;
}

export async function signUser({ username, password, safeSD }: signUser) {
  //validate session first -- not needed.
  const userPass = { username, password };

  safeSD = getSafeSD(safeSD as siteData)!;

  const { cookie, error } = await createUser({ userPass, safeSD });
  if (error) return { error };

  //update visitorFp function: update db to signed

  await setCookie("session", cookie!);
  if (safeSD) {
    const { error } = await scheduleShot(safeSD);
    if (error) return { error };
  }
  return { error: null };
}

export async function getUserData() {
  // here I'll collect all the info needed to display in frontend for an active session
  // eg: userName, unviewedShots, sites, notifications, notepad, deletion
  const { user } = await validateSession();
}

//rate limit this fn
export async function deleteAccount(password?: string) {
  //it treats deleting with pass as different from deletion attempts -- which will make deleting with pass, even when an attempt is registered, its own service (but can be handled F.End)
  const { error: e1, user } = await validateSession();
  if (e1) return { error: e1 };

  const { uid, error: e2 } = await checkUser({ username: user, password });
  if (e2) return { error: e2 };

  if (password && !uid) {
    const { success, remaining, reset } = await delAccountRate.limit(
      `user:${user}`,
    );
    if (!success) {
      const error = `You have been rate-limited, try again in ${new Date(reset).toLocaleString}`;
      throw { error };
    }
  }

  const delPass = uid ? true : false;

  const { deletionDue, deleted, error: e3 } = await deleteUser(user, delPass);
  if (e3) return { error: e3 };
  //set deletion notification separate from regular notification.

  //remove cookie session
  if (deleted) await unLogUser();

  //deletion due is UTC/timestamptz. Would rather render it in user's local time zone -- I don't think that's achieved with: .. perhaps use otherMethod()
}

export async function undeleteAccount() {
  const { error: e1, user } = await validateSession();
  if (e1) return { error: e1 };

  const { error: e2 } = await undeleteUser(user);
  if (e2) return { error: e2 };
}

//----------> Shots management
export async function scheduleShot(safeSD: siteData) {
  //can use this to unpause crons. instead of in that function

  const { user, error: e0 } = await validateSession();
  if (e0) return { error: e0 };

  safeSD = getSafeSD(safeSD)!;
  if (!safeSD) return { error: "Unsafe parameters" };

  const SDprops = { safeSD, user, del: false, re: false, ...safeSD };

  //updateShotSchema checks for false safeSD -- important
  const { saferSite, error: e1 } = await updateShotSchema(SDprops);
  if (e1) return { error: e1 };

  const { error: e2 } = await updateUserSites(SDprops);
  if (e2) return { error: e2 };

  const { error: e3 } = await updateCronTable(SDprops);
  if (e3) return { error: e3 };

  const { error: e4 } = await updateWorker(SDprops);
  if (e3) return { error: e4 };

  return { error: null };
}

export async function reactivateShot(safeSD: siteData) {
  //reactivate shots: in updateUserSites: sets site to active; in updateCronTable: will then reinsert cronData to activate
  //check active crons in cron table is < maxCron before activating for safe shooting
  // updateUserSite returns error: null indicating that all requirements including activeCrons < maxCrons suffices
  const { error: e1, user } = await validateSession();
  if (e1) return { error: e1 };

  safeSD = getSafeSD(safeSD)!;
  if (!safeSD) return { error: "Unsafe parameters" };

  const reProps = { safeSD, user, del: false };

  //e2 returns error if user's maxCrons has been reached.
  const { error: e2 } = await updateUserSites({ ...reProps, re: true });
  if (e2) return { error: e2 };

  //handles userSite.inactive when maxAppCrons is reached
  const updCronProps = { safeSD, user, del: false };
  const { error: e3 } = await updateCronTable({ ...updCronProps });
  if (e3) return { error: e3 };

  //handles cronTable.del and userSite.inactive when maxWorkerCrons is reached
  const { error: e4 } = await updateWorker({ ...updCronProps });
  if (e4) return { error: e4 };
}

export async function deactivateShot(site: string, cron: string) {
  //pauseCron: doesn't delete site data or column but removes from cronTable

  if (!getSafeSD({ site, cron })) return { error: "Unsafe params" };

  const { user, error: e0 } = await validateSession();
  if (!user) return { error: e0 };

  const safeSD = { site, cron };
  const delCronProps = { safeSD, user, del: true };

  const { error: e1 } = await setSiteInactive({ ...safeSD, user });
  if (e1) return { error: e1 };

  const { error: e2, delWorker } = await updateCronTable({ ...delCronProps });

  if (delWorker) {
    const { error: e3 } = await updateWorker({ ...delCronProps });
    return { error: e3 };
  }

  if (e2) return { error: e2 };
}

export async function deleteCron(safeSD: siteData) {
  //This will delete all shot records;

  const { user, error: e1 } = await validateSession();
  if (e1) return { error: e1 };

  safeSD = getSafeSD(safeSD)!;
  if (!safeSD) return "Unsafe parameters";

  const delProps = { safeSD, user, del: true, re: false, ...safeSD };

  const { error: e2 } = await updateShotSchema(delProps);
  if (e2) return { error: e2 };

  const { error: e3 } = await updateUserSites(delProps);
  if (e3) return { error: e3 };

  const { error: e4, delWorker: dW } = await updateCronTable(delProps);

  if (dW) {
    const { error: e5 } = await updateWorker(delProps);
    if (e5) return { error: e5 };
  }

  if (e4) return { error: e4 };
}

export async function testSite() {
  //gets a current shot for client feedback
}

//---------> analytics

//--------> frontend

export async function getSites() {
  const { user, error: e1 } = await validateSession();
  if (e1) throw { error: e1 };

  const { userSites, error: e2 } = await getUserSites({ user });
  if (e2) throw { error: e2 };

  return { userSites };
}

export async function getShots(prop: shotProp) {
  //handle displaying new shots coming in when you're scrolling through previous shots
  //thrown errors handled by reactQuery as reactQuery.error

  const { user, error: e1 } = await validateSession();
  if (e1) console.error({ error: e1 });

  //throws when !user
  const { userSites, error: e2 } = await getUserSites({ user });

  if (userSites?.[0]?.sites) {
    const { error, ...shotData } = await getUserShots({ ...prop, user: user! });
    if (error) throw error;
    return shotData;
  } else {
    const { error, ...shotData } = await getVisitorShots(prop);
    if (error) throw error;
    return shotData;
  }
}

export async function getDbShots(props: downloadProps) {
  //using just site & unviewed -- can handle incremental downloads with next & id
  const { unviewed, site, id, next } = props;

  const { user, error: e1 } = await validateSession();

  if (user && site)
    console.error("in getDbShots. Unknown user: ", { site, user });

  const { error, downloadShots } = await getDownloadShots({ ...props, user });
  if (!downloadShots) return { error };
  return { downloadShots };
}

export async function delShot({ ids }: { ids: number | number[] }) {
  //deletes a single shot
  if (!ids) throw { error: "Missing params!" };

  const { user } = await validateSession();
  if (!user) throw { error: "Unknown User!" };

  const { error } = await deleteShot({ user, ids });
  if (error) throw { error };

  return { error: null };
}

// records viewed shots: Errors caught in reactQuery.
export async function setViewed({
  ids,
  site,
}: Omit<shotProp, "id"> & { ids: number[] }) {
  const { user } = await validateSession();
  if (!user) throw { error: "Unknown user!" };

  const { error } = await setShotViewed({ ids, site, user });
  if (error) throw { error };

  return { error: null };
}

export async function getUnviewedCount() {
  const { user } = await validateSession();
  if (!user) return { error: "Unknown user!" };

  const { allUnvieweds, error } = await countUnviewedShots(user);
  if (!allUnvieweds) return { error: "Could not count user's unvieweds" };

  return { allUnvieweds };
}

//-----------> Helpers
function getSafeSD(safeSD: siteData) {
  //for quick param validation -- safeSD consuming functions also perform safety checks

  let { site, cron, range } = safeSD;
  site = safeSite(site)!;
  cron = safeCron(cron);
  range = safeRange(range);

  if (!site || !cron) return null;
  return { site, cron, range };
}

function getToken(cookie: string) {
  if (!cookie) return null;
  return encodeHexLowerCase(sha256(new TextEncoder().encode(cookie)));
}

//alter consuming files in server.js
function createCookie() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return encodeBase32LowerCaseNoPadding(bytes);
}

//--------> types
type signUser = {
  username: string;
  password: string;
  visitorFp?: string;
  safeSD?: siteData;
};

type siteData = {
  site: string;
  cron: string;
  range?: range;
  reactivate?: boolean;
};

export type shotProp = {
  site: string;
  id: number;
  next?: boolean;
};
