import puppeteer from "@cloudflare/puppeteer";
import { getCronSites, makeEntry, validateSession } from "./server.js";

// return new Response(body, {
//   headers: [
//     ['Set-Cookie', 'session=123abc'],
//     ['Set-Cookie', 'analytics=345def']
//   ]
// });

export default {
  async fetch(request, env) {
    return Res({ API: "active" });
    // const url = new URL(request.url);
    // let reqHost = new URL(request.headers.get("Origin"))?.hostname;
    // let { session, analytics } = new URL(request.headers.get("Cookies"));
    // console.log({ reqHost });
    // reqHost = reqHost.replace("www.", "");
    // if (reqHost != env.ALLOWED_HOST) return new Response(); //filter fake requests

    // switch (
    //   url.pathname
    // case "/validateSession": {
    //   const { validateSession } = await import("./server.js");
    //   const { user } = await validateSession(cookie, env);
    //   return new Response(JSON.stringify({ user }));
    // }

    // case "/logUser": {
    //   const { password, username } = await request.json();
    //   const { createSession } = await import("./server.js");
    //   const { error, cookieStr, analytics } = await createSession(
    //     password,
    //     username,
    //     env
    //   );
    //   if (!error && cookieStr) {
    //     return new Response(JSON.stringify({ error: "" }), {
    //       status: 200,
    //       body: JSON.stringify({ error }),
    //       headers: {
    //         "Set-Cookie": cookieStr,
    //         "Set-Cookie": analytics,
    //       },
    //     });
    //   }
    //   return new Response(JSON.stringify({ error }), {
    //     status: 400,
    //   });
    // }

    // case "/setShots": {
    //   const { crons } = await request.json();
    //   const { error } = await setShots(cookies, env);
    // }
    // ) {
    // }
  },

  async scheduled(event, env, ctx) {
    //will probably handle multicrons programmatically: update durable object with cron schedule and filter
    try {
      const { error, readySites } = await getCronSites(event.cron, env);
      if (error) throw error;

      const { shotData } = await takeShots(readySites, env);
      const { error: e2 } = await makeEntry({
        shotData,
        env,
      });
      if (e2) throw { error: e2 };
    } catch (e) {
      console.error("Error in schedule: " + e);
    }
  },
};

function Res(body, error) {
  return new Response(JSON.stringify(body), {
    status: error ? 400 : 200,
    headers: { "Content-Type": "text/plain" },
  });
}

async function takeShots(readySites, env) {
  try {
    const browser = await puppeteer.launch(env.CHROME);
    const shotData = [];

    //loops may break 10ms CPU time limit. Need workaround.
    for (const { site, range, uuid } of readySites) {
      if (site) {
        const page = await browser.newPage();
        const UA =
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.97 Safari/537.36";
        await page.setUserAgent(UA);
        await page.goto(site, { waitUntil: "load" });
        const html = await page.content();
        const buffer = await page.screenshot();
        const shot = buffer.toString("base64");
        shotData.push({ shot, html, range, site, uuid });
      }
    }
    return { shotData };
    //check that not more than 5 users pegged to a cron?
  } catch (e) {
    console.error("Error in getShot: ", e);
    return { error: "Error in getShot. " + e.message };
  }
}
