"use server";
import { cookies } from "next/headers";
import {
  createSession,
  createUser,
  deleteSession,
  createShotSchema,
  updateUserSites,
  updateWorker,
  validateSession,
  safeSite,
  safeCron,
  updateCronTable,
  checkUser,
  deleteUser,
  setNotification,
} from "./server";
import { unstable_cache } from "next/cache";

//session managment
export async function getCookie(name: "session" | "analytics") {
  const cookie = (await cookies()).get(name)?.value;
  return cookie;
}

async function setCookie(
  name: "session" | "analytics",
  value: string,
  expires?: Date
) {
  try {
    const cookie = (await cookies()).set(name, value, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: expires || new Date(Date.now() + 1000 * 3600 * 24 * 28),
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

//User auth
export async function logUser(username: string, password: string) {
  const { cookie, error } = await createSession(password, username);
  if (error) return { error };
  await setCookie("session", cookie);
}

export async function unLogUser() {
  const { error } = await deleteSession();
  await deleteCookie("session");
  return error;
}

export async function signUser({
  username,
  password,
  visitorFp,
  site,
  cron,
  range,
}: signUser) {
  //validate session first -- not needed.
  const u = { username, password };
  const sD = { site, cron, range };

  const { cookie, safeSD, error } = await createUser({ u, ...sD });
  //update visitorFp function: set signed
  if (error) return { error };
  await setCookie("session", cookie);
  if (safeSD) {
    const { error } = await scheduleShot(site!, safeSD!);
    return { error };
  }
  return { error: null };
}

export async function deleteAccount(password: string) {
  const { error, user } = await validateSession();
  if (error) return { error };

  if (password) {
    const { uid, error: e2 } = await checkUser({ username: user, password });
    if (e2) return { error: e2 };
    if (!uid) return { error: "Incorrect password" };

    const { error: e3 } = await deleteUser(user);
    return { error: e3 };
  } else {
    const { error: e4 } = await deleteUser(user, "deletionAttempt");
    if (e4) return { error: e4 };

    const nextMonth = new Date(Date.now() + 28 * 24 * 3600 * 1000);
    const message = `An attempt at deleting your account was made, and they will be able to on ${nextMonth.toString()}. 
    Unchecking 'Delete Account' in profile or deleting this notification prevents it. `;
    await setNotification({ message, user, danger: true, del: false });
  }
}

//Shots management
export async function scheduleShot(site: string, safeSD: siteData) {
  const { user, error: e0 } = await validateSession();
  if (e0) return { error: e0 };

  const SDprops = { safeSD, user, del: false };

  const { saferSite, prevSites, error: e1 } = await createShotSchema(site);
  if (e1) return { error: e1 };

  const { error: e2 } = await updateUserSites({ ...SDprops, prevSites });
  if (e2) return { error: e2 };

  const { error: e3 } = await updateCronTable({ ...SDprops });
  if (e3) return { error: e3 };

  const { error: e4 } = await updateWorker({ ...SDprops });
  if (e3) return { error: e3 };

  return { error: null };
}

export async function deleteSchedule(site: string, cron: string) {
  const { user, error: e1 } = await validateSession();
  if (e1) return { error: e1 };

  const safeSD = { site: safeSite(site)!, cron: safeCron(cron) };
  const delProps = { safeSD, user, del: true };

  const { error: e2 } = await updateUserSites({ ...delProps, prevSites: null });
  if (e2) return { error: e2 };

  const { error: e3, noCrons } = await updateCronTable({ ...delProps });
  if (e3) return { error: e3 };

  if (noCrons) {
    const { error: e4 } = await updateWorker({ ...delProps });
    if (e4) return { error: e4 };
  }
}

export async function deleteShotData(site: string) {
  const { user, error: e1 } = await validateSession();
  if (e1) return { error: e1 };

  const { error: e2 } = await createShotSchema(site, user, "delete");
  if (e2) return { error: e2 };
}

export async function testSite() {
  //gets a current shot for client feedback
}

//sessions and visitorFp
export async function updateLastLog() {
  //will run once a day
  const expires = new Date(Date.now() + 28 * 24 * 3600 * 1000);

  const lastLog = unstable_cache(
    async () => {
      const { error: e1, cookie } = await validateSession(expires);
      if (e1) return { error: e1 };

      const { error: e2 } = await setCookie("session", cookie, expires);
      return { error: e2 };
    },
    ["lastLog"],
    { tags: ["lastLog"], revalidate: 3 * 24 * 3600 }
  );

  return await lastLog();
}

//types
type signUser = {
  username: string;
  password: string;
  visitorFp: string;
  site?: string;
  cron?: string;
  range?: { start: number; end: number };
};

type siteData = {
  site: string | null;
  cron: string;
  range?: { start: number; end: number };
};
