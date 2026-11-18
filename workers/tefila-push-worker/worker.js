import { buildPushPayload } from "@block65/webcrypto-web-push";
import { dueAlerts, PRAYERS, ORANIT, subKey, prayerPayload, timesForRecord, isShabbatOrYomTovLocked } from "./schedule.mjs";

const ALLOWED_ORIGIN = "https://idanatwork.github.io";

function corsHeaders(req) {
  const origin = req.headers.get("Origin");
  if (origin !== ALLOWED_ORIGIN) return {};
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(req) },
  });
}

function originAllowed(req) {
  const origin = req.headers.get("Origin");
  // Same-origin / no Origin (cron, curl from Workers) is not browser CORS.
  // Browser requests always send Origin; require the siddur origin.
  if (!origin) return false;
  return origin === ALLOWED_ORIGIN;
}

function validSubscription(sub) {
  return (
    sub &&
    typeof sub.endpoint === "string" &&
    sub.endpoint.startsWith("https://") &&
    sub.keys &&
    typeof sub.keys.p256dh === "string" &&
    typeof sub.keys.auth === "string"
  );
}

function normalizeRecord(body, existing) {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const alerts = body.alerts && typeof body.alerts === "object" ? body.alerts : (existing && existing.alerts) || {};
  return {
    subscription: body.subscription,
    lat: Number.isFinite(lat) ? lat : ORANIT.lat,
    lng: Number.isFinite(lng) ? lng : ORANIT.lon,
    tz: typeof body.tz === "string" && body.tz ? body.tz : (existing && existing.tz) || ORANIT.tz,
    alerts: {
      shacharit: !!alerts.shacharit,
      // Preserve missing shacharitWhen so v47 subscriptions stay on sunrise.
      ...(alerts.shacharitWhen === "shema" || alerts.shacharitWhen === "sunrise"
        ? { shacharitWhen: alerts.shacharitWhen }
        : {}),
      ...(Number.isFinite(Number(alerts.shacharitOffset))
        ? { shacharitOffset: Number(alerts.shacharitOffset) }
        : {}),
      mincha: !!alerts.mincha,
      minchaOffset: Number.isFinite(Number(alerts.minchaOffset)) ? Number(alerts.minchaOffset) : 15,
      arvit: !!alerts.arvit,
      arvitOffset: Number.isFinite(Number(alerts.arvitOffset)) ? Number(alerts.arvitOffset) : 0,
    },
    lastSent: (existing && existing.lastSent) || {},
  };
}

async function handleSubscribe(req, env) {
  if (!originAllowed(req)) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid json" }, 400);
  }
  if (!validSubscription(body.subscription)) return json(req, { error: "invalid subscription" }, 400);
  const key = await subKey(body.subscription.endpoint);
  const existing = await env.SUBSCRIPTIONS_KV.get(key, { type: "json" });
  const record = normalizeRecord(body, existing);
  await env.SUBSCRIPTIONS_KV.put(key, JSON.stringify(record));
  return json(req, { ok: true, key });
}

async function handleUnsubscribe(req, env) {
  if (!originAllowed(req)) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid json" }, 400);
  }
  const endpoint = body.subscription?.endpoint || body.endpoint;
  if (!endpoint || typeof endpoint !== "string") return json(req, { error: "invalid subscription" }, 400);
  const key = await subKey(endpoint);
  await env.SUBSCRIPTIONS_KV.delete(key);
  return json(req, { ok: true });
}

async function sendPush(env, subscription, prayer) {
  const message = {
    data: JSON.stringify({ title: prayer.title, body: prayer.body, url: prayer.url }),
    options: { ttl: 60 * 60, urgency: "high" },
  };
  const payload = await buildPushPayload(message, subscription, {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  });
  return fetch(subscription.endpoint, payload);
}

export async function runSchedule(env, now, opts = {}) {
  const sent = [];
  const errors = [];
  let cursor;
  do {
    const page = await env.SUBSCRIPTIONS_KV.list({ cursor, limit: 1000 });
    for (const key of page.keys) {
      const record = await env.SUBSCRIPTIONS_KV.get(key.name, { type: "json" });
      if (!record || !validSubscription(record.subscription)) continue;
      let kinds;
      try {
        kinds = dueAlerts(record, now);
      } catch (err) {
        errors.push({ key: key.name, error: String(err) });
        continue;
      }
      if (opts.forceKind && !kinds.includes(opts.forceKind)) {
        if (opts.force) kinds = [opts.forceKind];
      }
      if (!kinds.length) continue;
      const lastSent = { ...(record.lastSent || {}) };
      const tz = record.tz || ORANIT.tz;
      const { times, alerts } = timesForRecord(record, now);
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      let changed = false;
      for (const kind of kinds) {
        try {
          const res = await sendPush(env, record.subscription, prayerPayload(kind, times, alerts, tz));
          if (res.status === 404 || res.status === 410) {
            await env.SUBSCRIPTIONS_KV.delete(key.name);
            sent.push({ key: key.name, kind, status: res.status, deleted: true });
            changed = false;
            break;
          }
          if (res.ok || res.status === 201) {
            lastSent[kind] = today;
            changed = true;
            sent.push({ key: key.name, kind, status: res.status });
          } else {
            errors.push({ key: key.name, kind, status: res.status });
          }
        } catch (err) {
          errors.push({ key: key.name, kind, error: String(err) });
        }
      }
      if (changed) {
        await env.SUBSCRIPTIONS_KV.put(key.name, JSON.stringify({ ...record, lastSent }));
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return { sent, errors, now: now.toISOString() };
}


const TEST_HOME = "https://idanatwork.github.io/LPs/tefila/";
const TEST_PAYLOAD = {
  title: "התראת בדיקה",
  body: "כך תיראה התראה לתפילה",
  url: TEST_HOME,
};

async function handleTest(req, env) {
  if (!originAllowed(req)) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid json" }, 400);
  }
  const endpoint = body.subscription?.endpoint || body.endpoint;
  if (!endpoint || typeof endpoint !== "string") return json(req, { error: "invalid subscription" }, 400);
  const key = await subKey(endpoint);
  const record = await env.SUBSCRIPTIONS_KV.get(key, { type: "json" });
  if (!record || !record.subscription || record.subscription.endpoint !== endpoint) {
    return json(req, { error: "not found" }, 404);
  }
  const limitKey = `ratelimit:test:${key}`;
  const recent = await env.SUBSCRIPTIONS_KV.get(limitKey);
  if (recent) return json(req, { error: "rate_limited" }, 429);
  await env.SUBSCRIPTIONS_KV.put(limitKey, String(Date.now()), { expirationTtl: 60 });
  try {
    const res = await sendPush(env, record.subscription, TEST_PAYLOAD);
    if (res.status === 404 || res.status === 410) {
      await env.SUBSCRIPTIONS_KV.delete(key);
      return json(req, { ok: false, deleted: true }, 410);
    }
    if (res.ok || res.status === 201) return json(req, { ok: true });
    return json(req, { error: "send_failed", status: res.status }, 502);
  } catch (err) {
    return json(req, { error: "send_failed" }, 502);
  }
}


async function handleBroadcast(req, env) {
  const secret = env.TEST_SEND_SECRET;
  if (!secret) return new Response(null, { status: 404 });
  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!title || !text) {
    return new Response(JSON.stringify({ error: "title and body required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  let url = typeof body.url === "string" ? body.url.trim() : TEST_HOME;
  if (!url.startsWith("https://idanatwork.github.io/")) url = TEST_HOME;
  const payload = { title, body: text, url };
  const now = new Date();
  const sent = [];
  const skipped = [];
  const errors = [];
  let cursor;
  do {
    const page = await env.SUBSCRIPTIONS_KV.list({ cursor, limit: 1000 });
    for (const key of page.keys) {
      if (key.name.startsWith("ratelimit:")) continue;
      const record = await env.SUBSCRIPTIONS_KV.get(key.name, { type: "json" });
      if (!record || !record.subscription || !record.subscription.endpoint) continue;
      const lat = Number(record.lat) || ORANIT.lat;
      const lon = Number(record.lng ?? record.lon) || ORANIT.lon;
      const tz = record.tz || ORANIT.tz;
      try {
        if (isShabbatOrYomTovLocked(now, lat, lon, tz)) {
          skipped.push({ key: key.name, reason: "shabbat" });
          continue;
        }
      } catch (err) {
        errors.push({ key: key.name, error: String(err) });
        continue;
      }
      try {
        const res = await sendPush(env, record.subscription, payload);
        if (res.status === 404 || res.status === 410) {
          await env.SUBSCRIPTIONS_KV.delete(key.name);
          sent.push({ key: key.name, status: res.status, deleted: true });
          continue;
        }
        if (res.ok || res.status === 201) sent.push({ key: key.name, status: res.status });
        else errors.push({ key: key.name, status: res.status });
      } catch (err) {
        errors.push({ key: key.name, error: String(err) });
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return new Response(JSON.stringify({ ok: true, sent, skipped, errors }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function handleTestSend(req, env) {
  const secret = env.TEST_SEND_SECRET;
  if (!secret) return new Response(null, { status: 404 });
  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const now = body.now ? new Date(body.now) : new Date();
  if (Number.isNaN(now.getTime())) {
    return new Response(JSON.stringify({ error: "invalid now" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const result = await runSchedule(env, now, { forceKind: body.kind, force: !!body.force });
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      if (!originAllowed(req)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }
    if (req.method === "POST" && url.pathname === "/subscribe") return handleSubscribe(req, env);
    if (req.method === "POST" && url.pathname === "/unsubscribe") return handleUnsubscribe(req, env);
    if (req.method === "POST" && url.pathname === "/test") return handleTest(req, env);
    if (req.method === "POST" && url.pathname === "/test-send") return handleTestSend(req, env);
    if (req.method === "POST" && url.pathname === "/broadcast") return handleBroadcast(req, env);
    if (req.method === "GET" && url.pathname === "/") {
      return new Response(JSON.stringify({ ok: true, vapidPublicKey: env.VAPID_PUBLIC_KEY }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
  async scheduled(_event, env) {
    await runSchedule(env, new Date());
  },
};
