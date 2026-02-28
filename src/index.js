// RawMon Scriptable Monitor — Cloudflare Worker
// Checks HTTP endpoints every minute, alerts on state CHANGE via KV.
//
// Configuration via environment variables (Settings > Variables in CF dashboard):
//   WEBHOOK_URL  — your RawMon webhook URL (from app > Scriptable > Setup)
//   ENDPOINTS    — JSON array, e.g. [{"name":"api","url":"https://api.example.com/health"}]

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
      try {
        const res = await fetch(ep.url, { method: "HEAD", redirect: "follow" });
        if (!res.ok) {
          status = "down";
          message = `HTTP ${res.status}`;
        }
      } catch (err) {
        status = "down";
        message = err.message || "Connection failed";
      }

      // State change detection via KV
      const prevStatus = (await env.MONITOR_STATE.get(ep.name)) || "up";
      if (status !== prevStatus) {
        await env.MONITOR_STATE.put(ep.name, status);
        await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monitor: ep.name, status, message }),
        });
      }
    }
  },
};
