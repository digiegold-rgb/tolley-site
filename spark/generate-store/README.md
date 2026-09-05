# Generate still store (Spark)

Private disk for `/generate` Modal stills. Vercel never publishes these as
`*.public.blob.vercel-storage.com` URLs.

## Layout

```
/home/jelly/growth-engine/shorts/generate-jobs/{job_id}/{index}.png
```

## Run on Spark

```bash
export GENERATE_SPARK_STORE_KEY='same-secret-as-vercel'
export GENERATE_SPARK_STORE_ROOT=/home/jelly/growth-engine/shorts/generate-jobs
export GENERATE_SPARK_STORE_HOST=127.0.0.1
export GENERATE_SPARK_STORE_PORT=8765
python3 /home/jelly/tolley-site/spark/generate-store/server.py
```

Put Caddy / Cloudflare / the existing `quickgen.tolley.io` tunnel in front so
**Vercel can reach it over HTTPS**. Tailscale `100.x` / `.ts.net` is fine on
the LAN; Vercel serverless cannot dial Tailscale unless a public hostname
terminates on Spark.

## Vercel env

| Variable | Notes |
|---|---|
| `GENERATE_SPARK_STORE_URL` | `https://quickgen.tolley.io` or the dedicated tunnel origin (no trailing slash) |
| `GENERATE_SPARK_STORE_KEY` | Same bearer as `GENERATE_SPARK_STORE_KEY` on Spark. May reuse `QUICKGEN_API_KEY` if you mount this app on that host. |

## Routes

- `PUT /generate-jobs/{job_id}/{index}` — raw `image/png` body
- `GET /generate-jobs/{job_id}/{index}` — PNG
- `GET /health` — liveness (no auth)

HQ never hits this host from the browser. `/generate` loads
`GET /api/generate/jobs/:id/image?i=0` after the same Jared/admin gate as Modal jobs.
