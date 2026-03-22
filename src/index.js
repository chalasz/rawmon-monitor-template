// RawMon Scriptable Monitor — Cloudflare Worker
// Checks HTTP endpoints every minute, alerts on state CHANGE via KV.
// Supports rich statuses: up / down / degraded (slow response).
//
// Configuration via environment variables (Settings > Variables in CF dashboard):
//   WEBHOOK_URL  — your RawMon webhook URL (from app > Scriptable > Setup)
//   ENDPOINTS    — JSON array, e.g.:
//     [{"name":"api","url":"https://api.example.com/health","degradedMs":5000}]
//     degradedMs (optional) — response time threshold in ms; if exceeded, status = "degraded"

export default {
  async scheduled(event, env) {
    const WEBHOOK_URL = env.WEBHOOK_URL;
    if (!WEBHOOK_URL) {
      console.error("WEBHOOK_URL not set");
      return;
    }

    let endpoints;
    try {
      endpoints = JSON.parse(env.ENDPOINTS || "[]");
    } catch {
      console.error("ENDPOINTS is not valid JSON");
      return;
    }

    if (endpoints.length === 0) {
      console.error("ENDPOINTS is empty");
      return;
    }

    for (const ep of endpoints) {
      let status = "up";
      let message = "";
      let responseTime = 0;
      let statusCode = 0;

      try {
        const start = Date.now();
        const res = await fetch(ep.url, { method: "HEAD", redirect: "follow" });
        responseTime = Date.now() - start;
        statusCode = res.status;

        if (!res.ok) {
          status = "down";
          message = `HTTP ${res.status}`;
        } else if (ep.degradedMs && responseTime > ep.degradedMs) {
          status = "degraded";
          message = `Slow response: ${responseTime}ms (threshold: ${ep.degradedMs}ms)`;
        }
      } catch (err) {
        status = "down";
        message = err.message || "Connection failed";
      }

      const metrics = { responseTime, statusCode };

      // State change detection via KV
      const prevStatus = (await env.MONITOR_STATE.get(ep.name)) || "up";
      if (status !== prevStatus) {
        await env.MONITOR_STATE.put(ep.name, status);

        // Build webhook URL with source=script so the relay uses the correct parser
        const url = new URL(WEBHOOK_URL);
        if (!url.searchParams.has("source")) {
          url.searchParams.set("source", "script");
        }

        await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monitor: ep.name, status, message, metrics }),
        });
      }
    }
  },
};
