# Cloud Sync Data Files

These JSON files are meant to live on your **data branch** (default: `cloud-data`).

Why? So your deployed static site can stay on `main` while your private data (checklists/settings + trades) stays off the public branch.

## What to do

1. Create a branch named `cloud-data` in GitHub (from `main` is fine).
2. On the `cloud-data` branch, create a folder named `cloud/`.
3. Add these two files to `cloud/`:
   - `orb_midpoint_settings_v1.json` (starts as `{}`)
   - `orb_midpoint_trades_v1.json` (starts as `[]`)

The Cloudflare Pages Functions will read/write these files via the GitHub Contents API.
