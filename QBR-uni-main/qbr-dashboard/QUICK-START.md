# QBR Dashboard — Quick Start

Thanks for the dashboard! It runs **entirely on your computer** — no installation account, no internet, and **your data never leaves your machine**.

## How to open it

### macOS
1. Unzip the folder.
2. Double‑click **`start-mac.command`**.
   - First time: if macOS blocks it, right‑click → **Open** → **Open**, *or* run `chmod +x start-mac.command` in Terminal.
3. Your browser opens the dashboard automatically. Keep the small black window open while you use it.

### Windows
1. Unzip the folder (right‑click the ZIP → **Extract All…**).
2. Double‑click **`start-windows.bat`**.
   - If SmartScreen warns: **More info → Run anyway**.
3. Your browser opens the dashboard automatically. Keep the console window open while you use it.

### Linux
1. Unzip the folder.
2. Run `./start-linux.sh` (you may first need `chmod +x start-linux.sh`).

> **No Python?** The launchers use Python (built into macOS/most Linux). On Windows, install Python 3 from python.org and tick *“Add to PATH”*. As a last resort you can open `index.html` directly, though a local server is recommended.

## Loading your data
1. Click **Upload Data** in the left sidebar.
2. Drag your CSV onto the matching category card (or click **browse**).
3. Need the format? Click **Template** on any card, or see **Settings > CSV schema**.

Required columns: **`Date, Category, Metric, Value`** (others are optional). A file missing a required column is rejected with a clear message.

## Your data is saved locally
Uploads persist in this browser between sessions (via `localStorage`). To wipe everything: **Settings → Clear all data**.

## To stop
Close the small server window (macOS/Windows/Linux), or press **Ctrl+C** in it.

---
For full documentation, see **README.md**.
