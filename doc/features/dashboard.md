# Dashboard & Real-time Traffic API

## Base Path
`/v1/api/dashboard`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/dashboard` | Get dashboard overview (stats, top items, etc.) |
| `GET` | `/v1/api/dashboard/live-traffic` | **SSE Stream**: Real-time unique visitor updates |

> Both endpoints require **Admin** role.

## Live Traffic Streaming (SSE)

The `/live-traffic` endpoint uses Server-Sent Events to push updates whenever the unique visitor count changes (polled every 5 seconds from D1).

### Example Client Usage

```javascript
const es = new EventSource('/v1/api/dashboard/live-traffic?token=ADMIN_JWT');
es.onmessage = (e) => {
  const { liveTraffic } = JSON.parse(e.data);
  console.log(`Active visitors: ${liveTraffic}`);
};
```
