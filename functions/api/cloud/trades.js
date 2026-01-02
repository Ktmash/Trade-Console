import { jsonResponse, textResponse, requireKeyIfConfigured, ghReadJson, ghWriteJson } from "./_github.js";

const TRADES_PATH = "cloud/orb_midpoint_trades_v1.json";

function simpleHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function ensureTradeMeta(t) {
  const out = { ...t };
  if (!out.id) {
    const basis = JSON.stringify([out.timestamp, out.symbol, out.side, out.entry, out.exit, out.qty, out.notes]);
    out.id = simpleHash(basis);
  }
  if (!out.updatedAt) out.updatedAt = out.timestamp || new Date().toISOString();
  return out;
}

function mergeTrades(remoteTrades, incomingTrades) {
  const map = new Map();

  for (const t of [...(remoteTrades || []), ...(incomingTrades || [])]) {
    const tr = ensureTradeMeta(t);
    const existing = map.get(tr.id);
    if (!existing) {
      map.set(tr.id, tr);
      continue;
    }
    const a = Date.parse(existing.updatedAt || existing.timestamp || 0);
    const b = Date.parse(tr.updatedAt || tr.timestamp || 0);
    map.set(tr.id, b >= a ? tr : existing);
  }

  return Array.from(map.values()).sort(
    (a, b) => Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0)
  );
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return textResponse("ok");

  const auth = requireKeyIfConfigured(request, env);
  if (!auth.ok) return auth.response;

  try {
    if (request.method === "GET") {
      const file = await ghReadJson(env, TRADES_PATH);
      if (!file.exists || file.data == null) return jsonResponse([]);
      return jsonResponse(Array.isArray(file.data) ? file.data : []);
    }


    if (request.method === "DELETE") {
      const msg = `Clear trades (${new Date().toISOString()})`;
      const result = await ghWriteJson(env, TRADES_PATH, [], msg);
      return jsonResponse({
        ok: true,
        requiresKey: auth.requiresKey,
        cleared: true,
        commit: result.commit?.sha || null,
        skipped: !!result.skipped
      });
    }

    if (request.method === "PUT") {
      const body = await request.json();
      const incoming = body && body.data;

      if (!Array.isArray(incoming)) {
        return jsonResponse({ error: "Bad Request: expected { data: <array> }" }, { status: 400 });
      }

      const remoteFile = await ghReadJson(env, TRADES_PATH);
      const remote = Array.isArray(remoteFile.data) ? remoteFile.data : [];

      const merged = mergeTrades(remote, incoming);

      const msg = `Update trades (${new Date().toISOString()})`;
      const result = await ghWriteJson(env, TRADES_PATH, merged, msg);

      return jsonResponse({
        ok: true,
        requiresKey: auth.requiresKey,
        commit: result.commit?.sha || null,
        skipped: !!result.skipped,
        mergedCount: merged.length
      });
    }

    return jsonResponse({ error: "Method Not Allowed" }, { status: 405 });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const status = msg.includes("GitHub PUT failed (409)") ? 409 : 500;
    return jsonResponse({ error: msg }, { status });
  }
}
