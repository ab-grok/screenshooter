// import dotenv from "dotenv";
// import { db, DB } from "./worker_server";
// import {cookies } from "next/headers"

// //db is livebound and will be init after DB()
// DB(process.env.DB_CONN)

// export async function logVisit({ visitorId, visitorFp }) {
//   //track average signup time
//   const r1 =
//     await db`select "visitorFp" as vfp, "visitorId" as vid, from "private"."analytics" where ${visitorFp} = any("visitorFp") OR ${visitorId} = any("visitorId")`;
//   if (r1[0]) {
//     const { vFp, vId } = r1[0];

//     let sqlFinal;
//     // const sqlWhere = db` where ${db.unsafe(
//     //   vFp?.[0] ? ` "visitorFp" @> ${vFp} ` : `"visitorId" @> ${vId}`
//     // )}`;
//     const sqlUpd = db`update table "private"."analytics" set "pageVisits" = "pageVisits" + 1`;
//     const sqlWhere = db`where ${
//       vFp?.[0]
//         ? `${db("visitorFp")} @> ${vFp} `
//         : `${db("visitorId")} @> ${vId}`
//     }`;

//     if (vFp?.includes(visitorFp) && !vId?.includes(visitorId)) {
//       sqlFinal = db`${sqlUpd} , "visitorFp" = array_append("visitorFp", ${visitorFp}) ${sqlWhere}`;
//     } else if (vId?.includes(visitorId) && !vFp?.includes(visitorFp)) {
//       sqlFinal = db`${sqlUpd} , "visitorId" = array_append("visitorId", ${visitorId}) ${sqlWhere}`;
//     } else sqlFinal = db`${sqlUpd + sqlWhere} `;
//   } else
//     sqlFinal = db`insert into "private"."analytics" ("visitorFp", "visitorId", "pageVisits") values (${[
//       visitorFp,
//     ]}, ${[visitorId]}, 1) `;

//   const res = await sqlFinal;

//   // const res2 = await db`insert into "private"."analytics" ()`;
// }

// export async function logSign({})
