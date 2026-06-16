# Path C — Cloudflare Tunnel (workstation / home server / behind NAT)

Run the **full** Kin stack — including the Phase C **preview engine** and the **code
sandbox** — on a single machine that has **no public inbound** (a dev Mac, a home server,
any box behind NAT/CGNAT), and expose it on your domain through a **Cloudflare Tunnel**.

- **No public IP, no port-forwarding, no open ports.** `cloudflared` makes an *outbound*
  connection to Cloudflare; traffic comes back down that tunnel.
- **TLS is terminated at the Cloudflare edge** — the tunnel→Traefik hop is plain HTTP, so
  there are no certs to manage on the host.
- This path gives you the elevated container privileges (`seccomp=unconfined`,
  `apparmor=unconfined`, `cap_add: NET_ADMIN`) that preview + sandbox need and that a hardened
  managed PaaS may not allow — so it's the fastest way to a **full-feature** trial.

```
Cloudflare edge (TLS, *.kin.example.com)
  └─ cloudflared  (outbound QUIC tunnel; no inbound ports)
        └─ Traefik (:80, Host routing, reads container labels)
              ├─ kin.example.com        → app (5000) ;  /ws → ws-server (3001)
              └─ <id>.kin.example.com   → preview sandbox container (4173), forward-auth gated
```

**Compose file:** [`docker-compose.tunnel.yml`](../../docker-compose.tunnel.yml) ·
**configs:** [`infra/tunnel/`](../../infra/tunnel/)

> This is **Path A + a tunnel**: the same bundled Traefik, plus a `cloudflared` container and
> (on macOS only) a small `dockerproxy` shim. On a normal cloud VPS with a public IP, prefer
> [Path A](docker-compose.md) (Let's Encrypt / your own certs) — you don't need the tunnel.

---

## Critical invariants (get any wrong → it won't serve)

1. **DNS is two **proxied** CNAMEs to the tunnel** — the apex `kin.example.com` **and** the
   single-level wildcard `*.kin.example.com`, both → `<TUNNEL_ID>.cfargotunnel.com` (orange cloud
   ON). Cloudflare's free Universal SSL covers the apex + one wildcard level; it does **not**
   cover two levels (`*.preview.kin.example.com`), so previews use **single-level** `<id>.kin.example.com`.
2. **Ingress lives in `infra/tunnel/config.yml`, not the dashboard.** Do **not** add Public
   Hostnames in the Zero-Trust UI — define `kin.example.com` + `*.kin.example.com` → `http://traefik:80`
   in `config.yml` so the wildcard works. (Dashboard-managed ingress can't express a wildcard.)
3. **`credentials.json` is a secret** (it holds the tunnel secret). It's gitignored — never commit it.
4. **Image pulls from GHCR by default** — `docker-compose.tunnel.yml` defaults to the prebuilt
   **multi-arch** image `ghcr.io/deeptoai-com/kin/app` (`APP_PULL_POLICY=always`), and a Mac
   uses the native **arm64** variant automatically. To build locally instead (no GHCR pull), set
   `APP_IMAGE=kin APP_TAG=local APP_PULL_POLICY=never`, build `kin:local`, and overlay
   `-f docker-compose.build.yml` so app + parser use their local `build:` stanza.
5. **ARK auth** uses `ANTHROPIC_AUTH_TOKEN` (Bearer) — do **not** set `ANTHROPIC_API_KEY`
   (setting it makes the SDK switch to `x-api-key` and ARK rejects it). Same as every other path.
6. **The `dockerproxy` shim is required on OrbStack/Docker Desktop AND on Docker 28/29+.**
   Traefik's docker provider pins API `v1.24`; a daemon whose minimum is `1.40` rejects it →
   `"client version 1.24 is too old"`. This hits **macOS (OrbStack/Docker Desktop)** *and*
   **modern Docker on any OS** (Docker 28/29 raised the minimum to 1.40 — verified on Docker 29
   / Ubuntu). `dockerproxy` (nginx) rewrites `/vX.Y/...` → `/v1.44/...`. Only **old Linux Docker
   (≤27)** can skip it and point Traefik at the socket directly (see the bottom).

---

## Steps

### 1. Create the tunnel + copy its token
Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel** → *Cloudflared* →
name it → copy the **token** (`eyJ...`). Do **not** add Public Hostnames here.

### 2. Generate credentials + set the tunnel id
From `infra/tunnel/` (both `config.yml` and `credentials.json` are gitignored — per-deploy):
```bash
cp config.yml.example config.yml
TOKEN='eyJ...'   # paste your tunnel token
TID=$(echo "$TOKEN" | base64 -d \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);open("credentials.json","w").write(json.dumps({"AccountTag":d["a"],"TunnelID":d["t"],"TunnelSecret":d["s"]}));print(d["t"])')
sed -i '' "s/REPLACE_WITH_TUNNEL_ID/$TID/" config.yml   # Linux: drop the '' after -i
echo "Tunnel ID: $TID"   # you need this for DNS in step 3
```
This writes `credentials.json` (the secret) and fills `tunnel:` in `config.yml`. If your
domain isn't `kin.example.com`, also edit the two `hostname:` lines in `config.yml`.

### 3. DNS (Cloudflare, both **proxied / orange**)
Point both records at the tunnel (replace `<TID>` with the id from step 2):

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `kin.example.com` (`@`) | `<TID>.cfargotunnel.com` | **Proxied** |
| CNAME | `*` | `<TID>.cfargotunnel.com` | **Proxied** |

### 4. Secrets (outside the repo)
Keep secrets in `~/kin-deploy/secrets.env` (chmod 600 — **never** in the repo / `.env`).
Minimum:
```bash
APP_HOSTNAME=kin.example.com
APP_NAME=kin
APP_NAME_SANITIZED=kin            # must be globally unique among your stacks (volume names)
# Postgres / MinIO / Meili / auth
POSTGRES_USER=kin POSTGRES_PASSWORD=... POSTGRES_DB=kin
MINIO_ROOT_USER=... MINIO_ROOT_PASSWORD=...
MEILI_MASTER_KEY=... BETTER_AUTH_SECRET=...   # openssl rand -hex 32
# LLM gateway (ARK / Volcengine) — Bearer auth, NOT ANTHROPIC_API_KEY
ANTHROPIC_AUTH_TOKEN=ark-xxxxxxxx
ANTHROPIC_BASE_URL=https://ark.cn-beijing.volces.com/api/coding
ANTHROPIC_MODEL=glm-5.1
ANTHROPIC_DEFAULT_SONNET_MODEL=glm-5.1
ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.1
ANTHROPIC_DEFAULT_HAIKU_MODEL=doubao-seed-2.0-lite
CLAUDE_CODE_SUBAGENT_MODEL=glm-5.1
```

### 5. Bring the stack up (pulls the prebuilt multi-arch image)
```bash
set -a; . ~/kin-deploy/secrets.env; set +a
docker compose -f docker-compose.tunnel.yml -p kin up -d   # pulls ghcr.io/deeptoai-com/kin/* (arm64 on a Mac)
```

> **Build locally instead** (no GHCR pull) — only if you want to run your own build:
> ```bash
> docker build -t kin:local .                               # native arm64 on a Mac
> export APP_IMAGE=kin APP_TAG=local APP_PULL_POLICY=never
> docker compose -f docker-compose.tunnel.yml -f docker-compose.build.yml -p kin up -d
> ```

### 6. Verify the stack locally (before trusting DNS)
All of these run **inside the host** and prove each hop without going out to Cloudflare.
`fetch()` from Node ignores a manual `Host` header, so test routing with `wget --header`:
```bash
# (a) everything up + db/redis/minio/meili healthy
docker compose -f docker-compose.tunnel.yml -p kin ps

# (b) cloudflared connected to the edge (expect 4x "Registered tunnel connection")
docker logs ${APP_NAME_SANITIZED}-cloudflared 2>&1 | grep "Registered tunnel connection"

# (c) Traefik routes the app — through the proxy container which has busybox wget
TIP=$(docker inspect ${APP_NAME_SANITIZED}-traefik -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
docker exec ${APP_NAME_SANITIZED}-dockerproxy sh -c \
  "wget -qS -O /dev/null --header='Host: kin.example.com' http://$TIP/health 2>&1 | grep HTTP/"   # → 200
docker exec ${APP_NAME_SANITIZED}-dockerproxy sh -c \
  "wget -qS -O /dev/null --header='Host: kin.example.com' http://$TIP/ws/agent 2>&1 | grep HTTP/" # → 426

# (d) sandbox is viable (user + net namespace must succeed in the app container)
docker exec kin-app sh -c 'unshare -Urn echo userns-ok'   # → userns-ok
```
Then open `https://kin.example.com` in a browser (DNS must be live from step 3).

### 7. Try the full preview + sandbox
In the chat, ask for a small multi-file web app, click **运行预览 / Run preview**. The
preview-controller spins up a sandbox container, Traefik picks it up by label, and you land on
`https://<id>.kin.example.com` after the one-time-token → cookie hand-off. Code execution (Python
etc.) runs in the same sandbox.

### 8. (Optional) Pre-warm the dependency cache — faster first preview
Every preview container mounts a **shared package-manager cache** (`/pm-cache`, the
`oxy-preview-pm-cache` volume) and points npm/pnpm/yarn at it, so installs reuse downloads
instead of re-fetching every run (measured: cold ≈ 15s → warm ≈ 4s for a React+Vite app).
The cache self-warms as you use it; to seed the common frameworks up front so even the very
first preview is fast, run once:
```bash
bash infra/preview/warm-cache.sh           # react/react-dom/vite/vue/typescript/tailwind…
# add more:  PREVIEW_WARM_DEPS="svelte @sveltejs/vite-plugin-svelte" bash infra/preview/warm-cache.sh
```
This applies to **all** deploy paths (the cache lives in the preview controller, not the proxy).

---

## Troubleshooting (issues actually hit bringing this up on macOS/OrbStack)

| Symptom | Cause | Fix |
|---|---|---|
| Traefik log: `client version 1.24 is too old. Minimum supported API version is 1.40` | macOS daemon (OrbStack/Docker Desktop) rejects Traefik's pinned API version | The bundled **`dockerproxy`** (nginx) rewrites the version prefix. It's already wired in `docker-compose.tunnel.yml`. (On Linux you can drop it — see below.) |
| `dockerproxy` log: `"user" directive is duplicate in /etc/nginx/nginx.conf` | Overriding `user` via `nginx -g` while the image's `nginx.conf` already sets `user nginx;` | We ship a **full** `infra/tunnel/nginx.conf` (with `user root;`) mounted at `/etc/nginx/nginx.conf` — no `-g` override. |
| `dockerproxy` → 502 `connect() to unix:/var/run/docker.sock failed (13: Permission denied)` | nginx workers ran as `nginx`; the socket is `root:root 0660` | `nginx.conf` sets `user root;` so workers can read the socket. |
| Traefik provider: `lookup dockerproxy ... no such host` | transient — `dockerproxy` was mid-recreate | Wait a few seconds / `up -d` again; Traefik retries automatically. |
| App routing returns **404** from your own `fetch()` test but the browser works | Node/undici **ignores a manual `Host` header** and sends `Host: <url-host>` → matches no router | Test with `wget --header='Host: kin.example.com'` (step 6c), not `fetch`. |
| Preview subdomain → **401** | Expected before auth: Traefik matched the preview router and ran forward-auth; no one-time token yet | Reach the preview through the app's **Run preview** button (it mints the token), not by hand. |
| `cloudflared` keeps reconnecting / `Unauthorized` | bad/[]rotated token or `credentials.json` mismatch | Re-run step 2 with a fresh token; confirm `tunnel:` id in `config.yml` matches `credentials.json`. |
| Site unreachable but stack is up | the host went to sleep / offline | This is a workstation path — the box must stay **on + online** for the site to be reachable. |

---

## Old Linux Docker (≤27): you may drop `dockerproxy`

The `dockerproxy` shim exists because Traefik's docker provider pins API `v1.24`, which daemons
with a minimum of `1.40` reject — that's **macOS (OrbStack/Docker Desktop)** *and* **Docker
28/29+ on any OS**. Only on **older Linux Docker (≤27)** can you delete the `dockerproxy` service
and point Traefik at the socket directly:

```yaml
  traefik:
    # remove:  - "--providers.docker.endpoint=tcp://dockerproxy:2375"
    # remove:  depends_on: [dockerproxy]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

Everything else (cloudflared, the bundled Traefik, labels, DNS) is identical.

---

## Notes

- **The host must stay on + online.** A Mac mini left on works well; a laptop that sleeps
  drops the tunnel. For an always-on box with a public IP, use
  [Path A — VPS](docker-compose.md) (the [one-command installer](../../scripts/install-vps.sh)).
- **`credentials.json` is a secret.** Gitignored; rotate the tunnel if it ever leaks.
- **Same images, same app** as the VPS path — only the edge (Cloudflare tunnel vs. your own
  proxy/TLS) differs.
