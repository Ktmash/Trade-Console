import { jsonResponse, textResponse, requireKeyIfConfigured, ghReadJson, ghWriteJson } from "./_github.js";

const SETTINGS_PATH = "cloud/orb_midpoint_settings_v1.json";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return textResponse("ok");
  }

  const auth = requireKeyIfConfigured(request, env);
  if (!auth.ok) return auth.response;

  try {
    if (request.method === "GET") {
      const file = await ghReadJson(env, SETTINGS_PATH);
      // Return just the settings object (not wrapped)
      if (!file.exists || file.data == null) {
        return jsonResponse({});
      }
      return jsonResponse(file.data);
    }

    if (request.method === "PUT") {
      const body = await request.json();
      const data = body && body.data && typeof body.data === "object" ? body.data : null;
      if (!data) {
        return jsonResponse({ error: "Bad Request: expected { data: <object> }" }, { status: 400 });
      }

      const msg = `Update settings (${new Date().toISOString()})`;
      const result = await ghWriteJson(env, SETTINGS_PATH, data, msg);
      return jsonResponse({ ok: true, commit: result.commit?.sha || null });
    }

    return jsonResponse({ error: "Method Not Allowed" }, { status: 405 });
  } catch (e) {
    return jsonResponse({ error: String(e && e.message ? e.message : e) }, { status: 500 });
  }
}
