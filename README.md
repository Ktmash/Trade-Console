# Trade Console – Cloud Sync (GitHub-backed)

This version of Trade Console adds **cloud sync** for:
- **Entry Checklist / Settings** (including checklists, tag suggestions, instruments, etc.)
- **Trade History**

It keeps the UI + localStorage behavior, but automatically syncs to GitHub via server-side API routes (so your token stays private).

## What changed

- Added Cloudflare Pages Functions (server routes):
  - `GET/PUT /api/cloud/settings`
  - `GET/PUT /api/cloud/trades`
  - `GET /api/cloud/ping`
- Added a Cloud Sync status pill at the top of the app.
- `saveSettings()` and `saveTradeHistory()` now **also** trigger cloud saves (debounced) when cloud sync is enabled.

## Quick setup (recommended: Cloudflare Pages)

GitHub Pages cannot run server code, so for cloud sync you need a host that supports serverless functions. Cloudflare Pages works great for this repo.

### 1) Create the `cloud-data` branch (stores your private JSON)

In GitHub:
1. Go to your repo → Branch dropdown → type `cloud-data` → create branch.
2. Switch to `cloud-data` branch.
3. Create folder `cloud/`.
4. Add these two files (you can copy from the `/cloud` folder in `main`):
   - `cloud/orb_midpoint_settings_v1.json` with contents: `{}`
   - `cloud/orb_midpoint_trades_v1.json` with contents: `[]`

### 2) Create a GitHub fine-grained token

GitHub → Settings → Developer settings → Fine-grained tokens:
- **Resource owner:** your user (or org)
- **Repository access:** only this repo
- **Permissions:**
  - **Contents: Read and write**

Copy the token once created.

### 3) Create a Cloudflare Pages project

Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages**:
1. Connect your GitHub account (if not already connected).
2. Select your repo.
3. Framework preset: **None**
4. Build command: *(leave blank)*
5. Build output directory: *(leave blank)*

### 4) Add environment variables in Cloudflare Pages

In your Pages project → **Settings** → **Environment variables**, add:

- `GITHUB_OWNER` = your GitHub username (or org)
- `GITHUB_REPO` = your repository name
- `GITHUB_TOKEN` = the fine-grained token you created
- `GITHUB_DATA_BRANCH` = `cloud-data`

Optional but recommended:
- `SYNC_KEY` = a passphrase you choose (e.g. `my-super-secret-sync-key`)
  - If set, the API will require this key in requests.
  - In the app, click **Key** and enter the same passphrase.

### 5) Deploy

Cloudflare Pages will auto-deploy on push. Once deployed:
- Open your site URL
- You should see **Cloud Sync** near the top.
- Click **Sync** once.

## Using it

- **Edits to checklists/tags/instruments**: save as normal → it will sync.
- **Trade history**: import your TradingView CSV or JSON → it will sync.
- On your phone: open the same deployed URL (or add to home screen) → click **Sync** → your trades/checklists should appear.

## Troubleshooting

- Cloud Sync says **Sync error**:
  - Open DevTools → Network tab → check `/api/cloud/ping`
  - If `missing` env vars are listed, add them in Cloudflare and redeploy.
  - If you set `SYNC_KEY`, make sure you entered it in the app via the **Key** button.
- If data doesn’t show up on another device:
  - Hit **Sync** (forces cloud → local refresh)

---

If you want to migrate away from GitHub commits (so every save isn’t a commit), the same UI can be wired to a lightweight KV/DB backend later.
