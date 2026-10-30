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

`GITHUB_TOKEN` já serve para push no GHCR (job `packages: write`).

## VPS (uma vez)

```bash
cp /caminho/do/repo/scripts/vps-redeploy-from-ghcr.sh /root/deploy-projects-from-ghcr.sh
chmod +x /root/deploy-projects-from-ghcr.sh
```

O script lê o `docker-compose.yaml` do Coolify, remove o bloco `build:` e sobe só com `image:`.

## Coolify — migrar para “só pull” (recomendado)

1. Painel Coolify → app **financial** (projects.linksystem.tech)
2. **Build Pack** → **Docker Image** (não Dockerfile no servidor)
3. Imagem: `ghcr.io/gbferrera/financial-ls:latest`
4. Registry: GitHub Container Registry + PAT `read:packages`
5. Desligar auto-deploy por git no Coolify (deploy passa a ser só via Actions)

Enquanto o Coolify ainda tiver `build:` no compose, o script `vps-redeploy-from-ghcr.sh` usa um compose derivado (`docker-compose.ghcr-run.yaml`) só no redeploy via Actions.

## Deploy manual

Actions → **Projects — build & deploy** → **Run workflow**

## Rollback

```bash
IMAGE=ghcr.io/gbferrera/financial-ls:<commit-sha-anterior> /root/deploy-projects-from-ghcr.sh "$IMAGE"
```
