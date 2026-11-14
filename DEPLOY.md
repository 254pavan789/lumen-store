# Put Lumen Store online for free (shareable link)

Result: a public link like **`https://lumen-store.onrender.com`** that anyone can open on a phone or laptop.
Everything works on it: the storefront, cart, checkout, orders, the Seller Hub, the Python engine and the database.

Total time: about 20 minutes. Cost: ₹0, and no credit card needed.

---

## Why not GitHub Pages?

GitHub Pages can only serve **static files** (HTML/CSS/JS). This project also needs:

| Part | Needs | GitHub Pages |
|---|---|---|
| Express API (`backend/`) | a running Node.js server | ❌ |
| Python engine (`engine/`) | a running Python process | ❌ |
| MySQL database | a database server | ❌ |

On GitHub Pages the site would open, but every product, cart checkout and Seller Hub page would fail.
So the setup below uses three free services, each doing one job:

```
 Visitor ──► Render (free)                       ──► TiDB Cloud Starter (free)
             Node.js + Express + Python engine        MySQL-compatible database
             built from YOUR GitHub repository        (data is kept permanently)
```

| Service | Job | Free plan |
|---|---|---|
| **GitHub** | stores your code; every upload redeploys the site | free |
| **Render** | runs the app (Docker: Node.js 22 + Python 3) | free web service: 512 MB RAM, 750 hours/month |
| **TiDB Cloud Starter** | the MySQL database (works with the app unchanged) | free: 5 GiB storage + 50 million request units per month, per instance |

---

## Step 1 — Create the free database (TiDB Cloud) · ~5 min

1. Open **https://tidbcloud.com** and sign up (the "Sign up with Google" or "Sign up with GitHub" buttons are the quickest).
2. Create an instance/cluster and choose the **Starter** plan (the free one).
   * Cloud provider: **AWS**
   * Region: **Singapore (ap-southeast-1)**. It's closest to India and matches the Render region used below. If it isn't offered, pick the nearest one. The app still works, just a little slower.
   * Name: `lumen-db` (any name is fine)
   * Click **Create**. It's ready in under a minute.
3. Open the new instance and click **Connect** (top right).
   * "Connect With": **General** (or "MySQL CLI")
   * Click **Generate Password** (or **Reset Password**) and **copy it now**. It's shown only once.
4. Copy these three values into Notepad:

   | Value in TiDB | Example | You will paste it into Render as |
   |---|---|---|
   | HOST | `gateway01.ap-southeast-1.prod.aws.tidbcloud.com` | `DB_HOST` |
   | USERNAME | `3xKm9AbCdEf.root` | `DB_USER` |
   | PASSWORD | `aB3dE5fG7hJ9kL1m` | `DB_PASSWORD` |

   The port is always **4000**, and that's already set for you.
   You don't need to create a database or tables: the app creates the `lumen_store` database, all tables and the sample products the first time it starts.

---

## Step 2 — Put the code on GitHub · ~5 min

1. Create a free account at **https://github.com** (skip this if you have one).
2. Install **Git for Windows**: https://git-scm.com/download/win (Next → Next → Install, keeping the defaults).
3. Create an empty repository: **https://github.com/new**
   * Repository name: `lumen-store`
   * Visibility: **Public** (or Private; Render can deploy both)
   * **Do NOT** tick "Add a README", ".gitignore" or "license". The repository must be empty.
   * Click **Create repository** and copy the URL it shows, e.g. `https://github.com/yourname/lumen-store.git`
4. In the project folder (the one with `package.json`), **double-click `push-to-github.bat`**.
   * Paste the repository URL and press Enter.
   * The first time, it asks for your name and e-mail (use your GitHub e-mail).
   * A browser window opens: sign in to GitHub and click **Authorize**.
   * You'll see `Done! Your code is on GitHub`.

   Your `.env` file (with your local MySQL password) is **never uploaded**, because `.gitignore` excludes it.

<details>
<summary>Prefer the command line? (same result)</summary>

```bat
cd C:\path\to\item-purchase-management
git init
git add -A
git commit -m "Lumen Store"
git branch -M main
git remote add origin https://github.com/yourname/lumen-store.git
git push -u origin main
```
</details>

---

## Step 3 — Deploy on Render · ~10 min (mostly waiting)

1. Open **https://dashboard.render.com** and sign up with **GitHub** (this connects your repositories).
2. Click **New +** → **Blueprint**.
3. Pick the `lumen-store` repository (click **Configure GitHub** if it isn't listed, and allow access to it).
   Render finds the `render.yaml` file in the project automatically.
4. Render asks for 3 values. Paste them from Step 1:

   | Key | Value |
   |---|---|
   | `DB_HOST` | the TiDB HOST |
   | `DB_USER` | the TiDB USERNAME (including the part before `.root`) |
   | `DB_PASSWORD` | the TiDB PASSWORD |

   Everything else (port 4000, TLS, database name, free plan, Singapore region, health check) is preset in `render.yaml`.
5. Click **Deploy Blueprint** (or **Apply**). The first build takes about 5–8 minutes.
6. Open the **lumen-store** service. Your link is at the top of the page:

   ### `https://lumen-store.onrender.com`

   (If someone already has that name, Render adds a few letters, e.g. `lumen-store-x7k2.onrender.com`.)

That's the link to share.

### Check that everything is connected

Open `https://<your-link>/api/health`. You should see:

```json
{"success":true,"data":{"engine":"python", ... "database":"lumen_store","mysql_version":"8.0.11-TiDB-v8.x ..."}}
```

`"engine":"python"` means the Python engine is running, and the `TiDB` version means the cloud database is connected.
In the Render **Logs** tab, the first start shows:

```
[deploy] preparing database ...
Connecting to MySQL xxxx.root@gateway01....tidbcloud.com:4000 (TLS) ...
  - schema ready in database 'lumen_store'
  - sample data loaded
[bridge] Python engine ready
```

---

## Updating the website later

Change any file → double-click **`push-to-github.bat`** again → Render redeploys automatically in a few minutes.
Your data stays: products, orders and stock live in TiDB, not on Render.

---

## Good to know (free-plan limits)

* **First visit after 15 minutes of no traffic takes about a minute.** Render's free plan pauses the app when nobody uses it and wakes it on the next visit. After that it's fast.
  *Optional, to keep it awake:* create a free monitor at https://uptimerobot.com (HTTP, every 5–10 minutes) for `https://<your-link>/api/health`. One always-on service fits inside Render's 750 free hours per month.
* **Data is permanent.** Restarts, sleeps and redeploys don't touch the database.
* **Anyone with the link can use the Seller Hub** (add or edit products, update orders), so treat it as a public demo.
  To reset the demo to the original 30 products with no orders, run this **on your laptop** in the project folder (Command Prompt):

  ```bat
  set DB_HOST=gateway01.ap-southeast-1.prod.aws.tidbcloud.com
  set DB_PORT=4000
  set DB_USER=3xKm9AbCdEf.root
  set DB_PASSWORD=your-tidb-password
  set DB_NAME=lumen_store
  set DB_SSL=true
  python engine\migrate.py --reset --seed
  ```
  (Use your own values from Step 1. Variables set this way take priority over your local `.env`.)
* **TiDB free quota:** 5 GiB and 50 million request units per month per instance, which is far more than a demo uses. If it were ever exceeded, the database would pause until the next month.

---

## Troubleshooting

| You see | Fix |
|---|---|
| Render log: `Access denied for user` | Wrong `DB_USER` / `DB_PASSWORD`. In TiDB, reset the password; in Render, go to the service → **Environment**, edit the values → **Save, rebuild and deploy**. |
| Render log: `Can't connect to MySQL server ... timed out` | Wrong `DB_HOST`, or a typo or space in it. Copy it again from TiDB → Connect. |
| Render log: `CERTIFICATE_VERIFY_FAILED` | Download the CA certificate from TiDB → Connect (the "CA cert" link), add it to the project as `database/ca.pem`, add the variable `DB_SSL_CA=database/ca.pem` in Render, and push again. |
| Page opens but shows "Database is unavailable" | Same as the rows above: check the three DB values. `/api/health` shows the exact error. |
| Deploy fails with "health check" | Open **Logs**; the line starting with `[deploy] WARNING` or `ERROR` explains why. |
| `push-to-github.bat` says upload failed | The GitHub repository must exist and be empty (no README). Check the URL. |
| Very slow first page | The free plan was asleep. Wait about 60 seconds; see "Good to know" above. |

---

## What was added to the project for hosting

| File | Purpose |
|---|---|
| `Dockerfile` | One container: Node.js 22 + Python 3 + PyMySQL; runs as a non-root user |
| `deploy/entrypoint.sh` | On start: creates or upgrades the tables, loads sample data **only into an empty database** (retries up to 90 s while the DB wakes), then starts the server |
| `render.yaml` | Render Blueprint: free web service, Singapore, health check `/api/health`, auto-deploy on every push |
| `push-to-github.bat` | One-click upload to your GitHub repository |
| `.gitignore`, `.dockerignore`, `.gitattributes` | Keep secrets and `node_modules` out; correct line endings for Linux |
| `engine/config.py` | New settings: `DATABASE_URL`, `DB_SSL`, `DB_SSL_CA` (verified TLS to cloud databases) |
| `engine/migrate.py` | New options: `--seed-if-empty`, `--wait SECONDS` |

The same image runs on any Docker host (Railway, Fly.io, Koyeb, a VPS):

```bash
docker build -t lumen-store .
docker run -p 10000:10000 -e DB_HOST=... -e DB_PORT=4000 -e DB_USER=... -e DB_PASSWORD=... -e DB_NAME=lumen_store -e DB_SSL=true lumen-store
```
