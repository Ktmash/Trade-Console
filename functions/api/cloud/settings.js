import { jsonResponse, textResponse, requireKeyIfConfigured, ghReadJson, ghWriteJson } from "./_github.js";

const SETTINGS_PATH = "cloud/orb_midpoint_settings_v1.json";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return textResponse("ok");

  const auth = requireKeyIfConfigured(request, env);
  if (!auth.ok) return auth.response;

  try {
    if (request.method === "GET") {
      const file = await ghReadJson(env, SETTINGS_PATH);
      if (!file.exists || file.data == null) return jsonResponse({});
      return jsonResponse((file.data && typeof file.data === "object" && !Array.isArray(file.data)) ? file.data : {});
    }

    if (request.method === "PUT") {
      const body = await request.json();
      const incoming = body && body.data;

      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
        return jsonResponse({ error: "Bad Request: expected { data: <object> }" }, { status: 400 });
      }

      const remoteFile = await ghReadJson(env, SETTINGS_PATH);
      const remote = (remoteFile.data && typeof remoteFile.data === "object" && !Array.isArray(remoteFile.data)) ? remoteFile.data : {};
      const merged = { ...remote, ...incoming, updatedAt: new Date().toISOString() };

      const msg = `Update settings (${new Date().toISOString()})`;
      const result = await ghWriteJson(env, SETTINGS_PATH, merged, msg);

      return jsonResponse({ ok: true, requiresKey: auth.requiresKey, commit: result.commit?.sha || null, skipped: !!result.skipped });
    }

    return jsonResponse({ error: "Method Not Allowed" }, { status: 405 });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const status = msg.includes("GitHub PUT failed (409)") ? 409 : 500;
    return jsonResponse({ error: msg }, { status });
  }
}
