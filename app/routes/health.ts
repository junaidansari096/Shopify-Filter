import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const checkDb = url.searchParams.get("db") === "1";

  let dbOk = true;
  if (checkDb) {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }
  }

  const payload = {
    status: dbOk ? "ok" : "degraded",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(payload), {
    status: dbOk ? 200 : 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
