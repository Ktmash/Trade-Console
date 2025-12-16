import { jsonResponse, textResponse, requireKeyIfConfigured } from "./_github.js";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return textResponse("ok");
  }

  const auth = requireKeyIfConfigured(request, env);
  if (!auth.ok) return auth.response;

  // Basic env sanity check (helps debugging misconfig quickly)
  const missing = [];
  if (!env.GITHUB_OWNER) missing.push("GITHUB_OWNER");
  if (!env.GITHUB_REPO) missing.push("GITHUB_REPO");
  if (!env.GITHUB_TOKEN) missing.push("GITHUB_TOKEN");

  return jsonResponse({
    ok: missing.length === 0,
    requiresKey: auth.requiresKey,
    dataBranch: env.GITHUB_DATA_BRANCH || "cloud-data",
    missing
  }, { status: missing.length === 0 ? 200 : 500 });
}
