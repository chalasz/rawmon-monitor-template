# RawMon Monitor Template — Cloudflare Worker

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/chalasz/rawmon-monitor-template)

A Cloudflare Worker that monitors HTTP endpoints every minute and sends push alerts to [RawMon](https://rawops.dev) on status changes.

## How It Works

1. Worker runs on a 1-minute cron schedule
2. Checks each endpoint with an HTTP HEAD request
3. Compares current status against previous state stored in KV
4. On state change (up → down or down → up), POSTs an alert to your RawMon webhook
5. You receive a push notification on your phone

## Quick Start

1. Click the **Deploy to Cloudflare Workers** button above
2. Complete the Cloudflare deploy flow
3. Create a KV namespace:
   ```bash
   wrangler kv namespace create MONITOR_STATE
   ```
4. Paste the KV namespace ID into `wrangler.toml`
5. Configure variables in the Cloudflare dashboard (Workers & Pages → your worker → Settings → Variables):
   - `WEBHOOK_URL` — your RawMon webhook URL (from app → Scriptable → Setup)
   - `ENDPOINTS` — JSON array of endpoints, e.g.:
     ```json
     [{"name":"api","url":"https://api.example.com/health"},{"name":"web","url":"https://example.com"}]
     ```
6. Deploy: `npx wrangler deploy`

## Manual Setup

```bash
# Clone
git clone https://github.com/chalasz/rawmon-monitor-template.git
cd rawmon-monitor-template

# Create KV namespace
wrangler kv namespace create MONITOR_STATE
# Copy the ID into wrangler.toml

# Set your variables in wrangler.toml
# Deploy
npx wrangler deploy
```

## Configuration

All configuration is done via environment variables — no code changes needed.

| Variable | Description | Example |
|----------|-------------|---------|
| `WEBHOOK_URL` | Your RawMon webhook URL | `https://push-relay.rawops.dev/webhook/...` |
| `ENDPOINTS` | JSON array of `{name, url}` objects | `[{"name":"api","url":"https://..."}]` |

## License

MIT
