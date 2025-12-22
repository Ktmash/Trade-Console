// Cloudflare Pages Function helper: GitHub Contents API (read/write JSON)

function toBase64Utf8(str) {
  // btoa/atob are Latin1-only; this wrapper makes UTF-8 safe.
  return btoa(unescape(encodeURIComponent(str)));
}

function fromBase64Utf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, PUT, OPTIONS",
    "access-control-allow-headers": "Content-Type, X-Sync-Key",
    "access-control-max-age": "86400"
  };
}

export function jsonResponse(obj, init = {}) {
  const headers = new Headers(init.headers || {});
  const cors = corsHeaders();
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(obj), { ...init, headers });
}

export function textResponse(text, init = {}) {
  const headers = new Headers(init.headers || {});
  const cors = corsHeaders();
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  headers.set("content-type", "text/plain; charset=utf-8");
  return new Response(text, { ...init, headers });
}

export function requireKeyIfConfigured(request, env) {
  const required = (env && env.SYNC_KEY) ? String(env.SYNC_KEY) : "";
  if (!required) return { ok: true, requiresKey: false };
  const provided = request.headers.get("X-Sync-Key") || "";
  if (provided !== required) {
    return { ok: false, requiresKey: true, response: jsonResponse({ error: "Unauthorized (missing/invalid sync key)" }, { status: 401 }) };
  }
  return { ok: true, requiresKey: true };
}

function ghHeaders(env) {
  const token = env.GITHUB_TOKEN;
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Trade-Console-CloudSync"
  };
}

function getRepoConfig(env) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const token = env.GITHUB_TOKEN;
  const branch = env.GITHUB_DATA_BRANCH || "cloud-data";
  if (!owner || !repo || !token) {
    throw new Error("Missing env: GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN");
  }
  return { owner, repo, branch };
}

export async function ghReadJson(env, path) {
  const { owner, repo, branch } = getRepoConfig(env);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: ghHeaders(env), cf: { cacheTtl: 0, cacheEverything: false } });
  if (res.status === 404) return { exists: false, sha: null, data: null };
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub GET failed (${res.status}): ${detail}`);
  }
  const file = await res.json();
  const jsonText = fromBase64Utf8(file.content || "");
  return { exists: true, sha: file.sha, data: JSON.parse(jsonText) };
}

// Bulletproof write: retries on 409 conflicts (concurrent updates)
export async function ghWriteJson(env, path, data, message) {
  const { owner, repo, branch } = getRepoConfig(env);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

  const nextText = JSON.stringify(data, null, 2);
  const nextB64 = toBase64Utf8(nextText);

  let last409Detail = "";

  for (let attempt = 0; attempt < 7; attempt++) {
    const existing = await ghReadJson(env, path);

    // If remote already matches what we're trying to write, don't commit again.
    if (existing.exists) {
      try {
        const remoteText = JSON.stringify(existing.data, null, 2);
        if (remoteText === nextText) {
          return { ok: true, skipped: true, reason: "no_changes" };
        }
      } catch (e) {}
    }

    const body = {
      message: message || "Update cloud data",
      content: nextB64,
      branch
    };
    if (existing.exists && existing.sha) body.sha = existing.sha;

    const res = await fetch(url, {
      method: "PUT",
      headers: { ...ghHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (res.ok) return res.json();

    const detail = await res.text().catch(() => "");

    if (res.status === 409) {
      last409Detail = detail;
      // Exponential backoff with jitter
      const base = 80 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 60);
      await sleep(Math.min(2000, base + jitter));
      continue;
    }

    throw new Error(`GitHub PUT failed (${res.status}): ${detail}`);
  }

  throw new Error(`GitHub PUT failed (409): ${last409Detail || "Conflict retry limit reached"}`);
}
