/**
 * Render Keep-Alive Service
 *
 * Keeps Render free-tier instances awake by sending a lightweight ping
 * to the service's public URL every 10 minutes (before the 15-minute idle limit).
 */

let keepAliveStarted = false;

export function initKeepAlive() {
  if (keepAliveStarted) {
    return;
  }
  keepAliveStarted = true;

  // Render automatically sets RENDER_EXTERNAL_URL (e.g. https://my-app.onrender.com)
  const targetUrl =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.SHOPIFY_APP_URL ||
    process.env.APP_URL;

  // Only run if a public external URL is configured and in production (or explicitly forced)
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.FORCE_KEEP_ALIVE === "true";

  if (!targetUrl || !isProduction) {
    return;
  }

  // Render free tier sleeps after 15 minutes of inactivity.
  // We ping every 10 minutes (600,000 ms) to keep the routing layer active.
  const PING_INTERVAL_MS = 10 * 60 * 1000;

  const ping = async () => {
    try {
      const endpoint = new URL("/health", targetUrl).toString();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(endpoint, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "Fresheek-KeepAlive/1.0",
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);
      if (!res.ok) {
        // Degraded or error response, but incoming request succeeded at the router level
      }
    } catch {
      // Catch network timeouts or temporary DNS errors silently — zero crashes
    }
  };

  // Run first ping after 1 minute, then every 10 minutes
  const initialTimeout = setTimeout(() => {
    ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);
    if (typeof interval.unref === "function") {
      interval.unref();
    }
  }, 60 * 1000);

  if (typeof initialTimeout.unref === "function") {
    initialTimeout.unref();
  }
}