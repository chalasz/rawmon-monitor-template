# RawMon Monitor Template — Cloudflare Worker

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/chalasz/rawmon-monitor-template)

A Cloudflare Worker that checks HTTP endpoints every minute and pushes alerts to [RawMon](https://rawops.dev/rawmon) on status changes. Stays inside the free tier.

## What you get

- **HTTP health checks** via a `HEAD` request with redirect follow
- **Rich statuses**: `up` / `down` / `degraded` — degraded fires when `responseTime` exceeds a per-endpoint `degradedMs` threshold
- **Edge-transition only**: state is compared against a KV snapshot, so RawMon gets one notification per state change rather than every minute
- **Response-time metrics** in the alert payload, so RawMon's history view plots real latency

## How it works

1. Worker runs on a 1-minute cron schedule (`* * * * *`)
2. For each endpoint: HEAD request, measure elapsed time, derive status
3. Compare new status to the previous one stored in `MONITOR_STATE` KV
4. On **state change** (e.g. `up → degraded`, `down → up`), POST a JSON body to your RawMon webhook (with `?source=script` appended so the relay picks the right parser)
5. RawMon delivers the push to your phone

## Quick start

1. Click **Deploy to Cloudflare Workers** above. Complete the Cloudflare flow (it'll fork the repo + wire up the build).
2. Create a KV namespace for state storage:
   ```bash
   npx wrangler kv namespace create MONITOR_STATE
   ```
   Paste the returned `id` into `wrangler.toml` under `[[kv_namespaces]]`.
3. Set two variables in Cloudflare dashboard → Workers & Pages → your worker → Settings → Variables:
   - **`WEBHOOK_URL`** — copy from RawMon app → Settings → Push Notifications → Webhook URL (format: `https://rawmon-push-relay.rawops.workers.dev/?deviceId=<your-uuid>`)
   - **`ENDPOINTS`** — JSON array of endpoints (see below)
4. Deploy:
   ```bash
   npx wrangler deploy
   ```

## Manual setup (no Deploy button)

```bash
git clone https://github.com/chalasz/rawmon-monitor-template.git
cd rawmon-monitor-template
npm install
npx wrangler kv namespace create MONITOR_STATE
# Paste the id into wrangler.toml
# Edit [vars] in wrangler.toml (or set them via `wrangler secret put` for sensitive values)
npx wrangler deploy
```

## Configuration

### `WEBHOOK_URL` (required)

Copy from RawMon: **Settings → Push Notifications → Scriptable → Webhook URL**. Format:

```
https://rawmon-push-relay.rawops.workers.dev/?deviceId=<YOUR-UUID>
```

The worker appends `&source=script` automatically before sending, so you can leave it off or include it — both work. The `deviceId` is unique per device and stable across app updates; treat it as a shared secret, since anyone with the URL can push alerts into your RawMon install.

### `ENDPOINTS` (required)

JSON array of `{name, url, degradedMs?}` objects:

```json
[
  { "name": "api", "url": "https://api.example.com/health" },
  { "name": "web", "url": "https://example.com", "degradedMs": 3000 },
  { "name": "db-internal", "url": "https://db.lan/ping", "degradedMs": 500 }
]
```

| Field | Required | Purpose |
| --- | --- | --- |
| `name` | yes | Monitor name shown in RawMon. Must be stable — it's the KV key + the correlation id. |
| `url` | yes | Full URL including scheme. `HEAD` request is sent. |
| `degradedMs` | no | Response-time threshold in milliseconds; above this the status becomes `degraded` instead of `up`. Omit to skip degradation. |

## Testing

Force a state transition to verify the webhook wiring without waiting for a real outage:

```bash
# Trigger manually via the Cloudflare dashboard:
# Workers & Pages → your worker → Trigger schedule
# Or locally:
npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled"
```

You should receive a push on your phone within seconds. If not, check:

- Worker logs: `npx wrangler tail`
- RawMon app → Settings → Push Notifications → send a test push from there to confirm the relay path is reachable

## Cost

Free tier covers this:

- **Workers**: 100k invocations/day; a 1-minute cron = 1,440/day
- **KV**: 100k reads + 1k writes per day; one read per endpoint per minute, write only on state change

A worker monitoring ~50 endpoints at 1-minute cadence still fits comfortably inside the free allowance.

## Limitations

- **HTTP only** — DNS, TCP, and ICMP checks are not in this template. Use RawMon's native monitors on your phone for those.
- **HEAD-based** — some servers reject HEAD or return different status codes than GET. Adjust `method` in `src/index.js` if needed.
- **No authentication** — if the endpoint requires a bearer token, add the header manually in `src/index.js`.

## License

MIT
