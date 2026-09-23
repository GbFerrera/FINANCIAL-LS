# 🚀 Deploy Configuration - Link Financial

## ⚠️ Problema Identificado: 502 Bad Gateway após ~2 horas

### 🔧 Correções Implementadas

1. **Next.js configurado para acesso externo**
   - `package.json`: `"start": "next start -p 3000 -H 0.0.0.0"`

2. **Healthcheck otimizado**
   - Mudou de Node.js para `wget` (mais confiável)
   - Intervalos aumentados: 30s interval, 60s start_period
   - Removeu dependência do banco no healthcheck

3. **Rota `/api/health` simplificada**
   - Não depende mais do Prisma/banco
   - Retorna resposta simples e rápida

4. **Dockerfile atualizado**
   - Adicionado `wget` para suporte ao healthcheck

## 🌍 Variáveis de Ambiente Configuradas

### Production
```bash
NEXTAUTH_URL=https://projects.linksystem.tech
NEXTAUTH_SECRET=Qv9x3e6lZc5Jk8FhR1b0u4mP2aT7YwN+SxDqL9C0gV=
SERVICE_URL_APP=https://projects.linksystem.tech
SERVICE_FQDN_APP=projects.linksystem.tech
SEED_DB=false
SEED_ADMIN_NAME=Gabriel Ferreira
SEED_ADMIN_EMAIL=business.gabrielferreira@gmail.com
SEED_ADMIN_PASSWORD=Gb1847@@
```

### Preview Deployments
```bash
NEXTAUTH_URL=https://projects.linksystem.tech
SERVICE_URL_APP=http://cosg4ccwsoc4s0wccco0k0gk.72.61.219.179.sslip.io
SERVICE_FQDN_APP=cosg4ccwsoc4s0wccco0k0gk.72.61.219.179.sslip.io
```

## Migrations em produção (Coolify)

O **Dockerfile** usa `scripts/start-prod.sh`: `prisma migrate deploy` antes de `node server.js`.

Se aparecer **500** em pipeline/tarefas/etiquetas após deploy de schema novo:

```bash
# Na VPS (container do projects — nome pode variar)
docker ps --format '{{.Names}}' | grep -i financial
docker exec -it <NOME_DO_CONTAINER> npx prisma migrate deploy
docker restart <NOME_DO_CONTAINER>
docker logs --tail 100 <NOME_DO_CONTAINER>
```

Erro típico nos logs: `relation "task_labels" does not exist` → migration `20260915120000_task_labels` não aplicada.

## 🎯 Próximos Passos

1. **Rebuild** a aplicação no Coolify
2. **Deploy** com as novas configurações
3. **Monitorar logs** para verificar se o problema foi resolvido:
   ```bash
   docker logs -f financial_app
   ```

## 🔍 Monitoramento

- Healthcheck agora em `/api/health` (simples, sem DB)
- Logs devem mostrar menos falhas de healthcheck
- Container não deve mais ser derrubado após 2 horas

## 📝 Observações

- **React 19 + Next.js 15.5.3**: Pode haver incompatibilidades com algumas libs
- **Excalidraw/Radix**: Monitorar por possíveis crashes em runtime
- **NEXTAUTH_URL**: Deve sempre apontar para o domínio correto em produção
