import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server";
import { getStorefrontConfig } from "../services/filters.server";

// In-memory rate limiting map: ipOrShop -> { count: number, resetTime: number }
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 reqs/min

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  // Clean up old entries periodically
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetTime) {
        rateLimitMap.delete(k);
      }
    }
  }

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const rawShop = url.searchParams.get("shop")?.trim();

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!rawShop) {
    return Response.json(
      { error: "Missing shop parameter" },
      { status: 400, headers: corsHeaders }
    );
  }

  const shop = rawShop.toLowerCase();

  // Basic domain format validation
  if (shop.length > 100 || !/^[a-z0-9][a-z0-9\-.]+\.[a-z]{2,}$/i.test(shop)) {
    return Response.json(
      { error: "Invalid shop domain format" },
      { status: 400, headers: corsHeaders }
    );
  }

  // Rate-limiting check
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || shop;
  if (!checkRateLimit(clientIp)) {
    return Response.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: corsHeaders }
    );
  }

  const shopRow = await prisma.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!shopRow) {
    return Response.json(
      {
        filters: [],
        appearance: null,
        settings: null,
      },
      { headers: corsHeaders }
    );
  }

  const config = await getStorefrontConfig(shopRow.id);
  return Response.json(config, { headers: corsHeaders });
}
