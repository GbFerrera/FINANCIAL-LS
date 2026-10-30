# Deploy Projects — GitHub Actions + GHCR

Objetivo: **build no GitHub Actions**, VPS só faz **pull** da imagem (sem `npm run build` no servidor).

## Fluxo

1. Push na `main` (ou *workflow_dispatch*) → workflow `.github/workflows/projects-deploy.yml`
2. Job **build**: `docker build` + push `ghcr.io/gbferrera/financial-ls:<sha>` e `:latest`
3. Job **deploy**: SSH na VPS → `/root/deploy-projects-from-ghcr.sh` → `docker compose up` com imagem GHCR

## Secrets no GitHub (Settings → Secrets → Actions)

| Secret | Uso |
|--------|-----|
| `PROJECTS_NEXTAUTH_SECRET` | Build-arg `NEXTAUTH_SECRET` (mesmo valor de prod) |
| `PROD_SSH_HOST` | Ex.: `72.61.219.179` |
| `PROD_SSH_PASSWORD` ou `PROD_SSH_KEY` | Acesso root/deploy na VPS |
| `PROD_SSH_USER` | Opcional (default `root`) |
| `GHCR_READ_TOKEN` | PAT GitHub `read:packages` — pull manual na VPS / Coolify registry (opcional; workflow usa `GITHUB_TOKEN` se vazio) |

`GITHUB_TOKEN` já serve para push no GHCR (job `packages: write`).

## VPS (uma vez)

```bash
cp /caminho/do/repo/scripts/vps-redeploy-from-ghcr.sh /root/deploy-projects-from-ghcr.sh
chmod +x /root/deploy-projects-from-ghcr.sh
```

O script lê o `docker-compose.yaml` do Coolify, remove o bloco `build:` e sobe só com `image:`.

## Coolify — migrar para “só pull” (recomendado)

**Automático (via Actions):** Actions → **Coolify — configurar GHCR only** → *Run workflow*  
(roda `scripts/coolify-configure-ghcr-only.sh` na VPS: desliga auto-deploy Git, `build_pack` dockerimage, compose só com `image:` GHCR)

**Manual no painel (espelho):**

1. Painel Coolify → app **financial** (projects.linksystem.tech)
2. **Build Pack** → **Docker Image**
3. Imagem: `ghcr.io/gbferrera/financial-ls:latest`
4. Registry: GitHub Container Registry + PAT `read:packages` (secret `GHCR_READ_TOKEN` no GitHub)
5. Desligar **Automatic Deployment** (git push)

## Deploy manual

Actions → **Projects — build & deploy** → **Run workflow**

## Rollback

```bash
IMAGE=ghcr.io/gbferrera/financial-ls:<commit-sha-anterior> /root/deploy-projects-from-ghcr.sh "$IMAGE"
```
