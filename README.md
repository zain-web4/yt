# YT Automation Suite (Scan + Download + S3)

This project is a frontend automation dashboard for YouTube workflows.

## What it supports

- Single channel mode (enter one channel URL/handle).
- Excel batch mode (`.xlsx/.xls`) with multiple channels.
- Channel metadata scan with proxy or direct mode.
- Download profile set to 1080p or higher.
- Anti-IP-ban strategy toggles (IP rotation, jitter, user-agent pool).
- Upload configuration to Amazon S3.
- End-to-end plan preview + run simulation in one UI.

## Excel format

Use first sheet with at least this column:

- `channel` (required)

Optional columns:

- `proxy`
- `quality`
- `s3Prefix`

## Run locally

```bash
python3 -m http.server 4173
```

Then open: `http://localhost:4173`
