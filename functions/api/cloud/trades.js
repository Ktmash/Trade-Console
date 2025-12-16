import { jsonResponse, textResponse, requireKeyIfConfigured, ghReadJson, ghWriteJson } from "./_github.js";

const TRADES_PATH = "cloud/orb_midpoint_trades_v1.json";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return textResponse("ok");
  }

  const auth = requireKeyIfConfigured(request, env);
  if (!auth.ok) return auth.response;

  try {
    if (request.method === "GET") {
      const file = await ghReadJson(env, TRADES_PATH);
      if (!file.exists || file.data == null) {
        return jsonResponse([]);
      }
      return jsonResponse(Array.isArray(file.data) ? file.data : []);
    }

    if (request.method === "PUT") {
      const body = await request.json();
      const data = body && body.data;
      if (!Array.isArray(data)) {
        return jsonResponse({ error: "Bad Request: expected { data: <array> }" }, { status: 400 });
      }

      const msg = `Update trades (${new Date().toISOString()})`;
      const result = await ghWriteJson(env, TRADES_PATH, data, msg);
      return jsonResponse({ ok: true, commit: result.commit?.sha || null });
    }

    return jsonResponse({ error: "Method Not Allowed" }, { status: 405 });
  } catch (e) {
    return jsonResponse({ error: String(e && e.message ? e.message : e) }, { status: 500 });
  }
}
