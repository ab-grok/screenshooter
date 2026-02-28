import puppeteer from "@cloudflare/puppeteer";
import { getCronSites, makeEntry, setNotification } from "../server.js";
import * as jose from "jose";

export default {
  async fetch(request, env) {
    function Res(body, error) {
      return new Response(JSON.stringify(body), {
        status: error ? 400 : 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return Res({ API: "Active!" });
  },

  async scheduled(event, env, ctx) {
    //will probably handle multicrons programmatically -- crons with intersecting firings: can update durable object with cron schedule and filter (why - it uses V8 isolates?)

    const cron = event.cron;

    try {
      const p = { cron, Auth, env, endpoint: "/getCronSites" };
      const { data, Auth } = await Fetch({ ...p, method: "GET" });

      const { readySites, id, error } = data;
      if (!readySites) return;

      const p2 = { readySites, id, cron, Auth, env };
      const { error: e2 } = await takeShots(p2);

      if (e2) throw { error: e2 };
    } catch (e) {
      console.error("Error in scheduled: ", e);

      const msg = `Error in scheduled: ${JSON.stringify(e)}`;
      const msgData = { msg, danger: true, postAdmin: true };
      const p = { cron, Auth, env, body: { msgData } };
      await Fetch({ ...p, method: "POST", endpoint: "/setNotification" });
    }
  },
};

async function takeShots({ readySites, id, cron, Auth, env }) {
  try {
    const browser = await puppeteer.launch(env.CHROME);

    //loop may break free tier's 10ms CPU time limit. -- eased now since API calls are made to
    for (const { site, range, user } of readySites) {
      try {
        if (!site || !user)
          throw { error: `Missing params. Site: ${site}, User: ${user}` };

        const page = await browser.newPage();
        const UA =
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
        await page.setUserAgent(UA);

        const stats = await page.goto(site);

        if (stats.status() >= 400) {
          console.error(`in takeShots. Page broken. Status`, stats);
          //can continue and set notification, or store broken page as is -- storing broken page as is for experimentation (is low html file size regardless).
        }

        const html = await page.content();

        const pageArg = { type: "jpeg", quality: 80, encoding: "base64" };
        const shot = await page.screenshot({ fullPage: true, ...pageArg });
        // del all > 24h saves; -- done in make entry ?

        const shotData = { shot, html, range, site, user, id };

        const param = { cron, Auth, env, endpoint: "/makeEntry" };
        await Fetch({ ...param, method: "POST", body: shotData }); //add id
      } catch (e) {
        console.error("Error in takeShot's for loop: ", e);

        const msg = `Error in readySites, Site: ${site}, User: ${user}, Error: ${JSON.stringify(e)}`;
        const msgData = { msg, danger: true, postAdmin: true };
        const p = { cron, Auth, body: { msgData }, env };
        await Fetch({ ...p, endpoint: "/setNotification", method: "POST" });
      }
    }

    return;
    //check that not more than 5 users pegged to a cron to serve worker limits
  } catch (e) {
    console.error("Error in getShot: ", e);

    const msg = `Error in getShot: ${JSON.stringify(e)}`;
    const msgData = { msg, danger: true, postAdmin: true };
    const p = { cron, Auth, env, body: { msgData } };
    await Fetch({ ...p, endpoint: "/setNotification", method: "POST" });
  } finally {
    if (browser) await browser.close();
  }
}

//--------> helpers

async function Fetch({ cron, Auth, endpoint, method, body, env }) {
  //pass body as object;
  !Auth && (Auth = await createJWT({ cron, env }));

  const headers = {
    Authorization: Auth,
    "Content-Type": "application/json",
  };

  const res = await fetch(env.SHOOTERAPI + endpoint, {
    method,
    headers,
    ...(method != "GET" && { body: JSON.stringify(body) }),
  });

  const data = await res?.json();
  return { Auth, data };
}

async function createJWT({ cron, env }) {
  const secret = new TextEncoder().encode(env.JWTSecret);

  return await new jose.SignJWT({ cron })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1m")
    .sign(secret);
}
