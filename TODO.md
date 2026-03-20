# HireHuman MCP - Manuelle To-Dos

## 1. GitHub Repository erstellen
- [ ] Neues Repo `hirehuman/hirehuman-mcp` auf GitHub anlegen (public)
- [ ] `cd "F:\Auto Claude - Projekte\hirehuman-mcp"`
- [ ] `git init && git add . && git commit -m "Initial commit: hirehuman-mcp v1.0.0"`
- [ ] `git remote add origin https://github.com/hirehuman/hirehuman-mcp.git`
- [ ] `git push -u origin main`

## 2. npm veröffentlichen
- [ ] `npm login` (npm-Account nötig, https://www.npmjs.com/signup)
- [ ] `npm publish --access public` (erster Publish)
- [ ] Prüfen auf https://www.npmjs.com/package/hirehuman-mcp

## 3. GitHub CI einrichten (Auto-Publish bei Tags)
- [ ] In GitHub Repo Settings > Secrets > Actions: `NPM_TOKEN` hinzufügen
  - Token erstellen unter https://www.npmjs.com/settings/~/tokens (Automation-Token)
- [ ] Ab jetzt publiziert `git tag v1.0.1 && git push --tags` automatisch

## 4. Frontend deployen (Agents-Seiten aktualisiert)
- [ ] `deploy_ssh.py` ausführen oder manuell:
  - Frontend: `dist/` nach `/opt/hirehuman/dist` auf dem Server
  - Geänderte Dateien: `HHApiDocsPage.tsx`, `HHLandingAgentPage.tsx`

## 5. Backend deployen (Conversations-Feature)
- [ ] Folgende Dateien auf den Server deployen:
  - `backend/prisma/migrations/20260307060000_add_hh_messages/migration.sql`
  - `backend/prisma/schema.prisma`
  - `backend/src/routes/hh/mcp.ts`
  - `backend/src/routes/hh/humans.ts`
  - `backend/src/routes/openapi.ts`
  - `backend/src/utils/messageRateLimit.ts`
  - `backend/src/services/hhWebhookService.ts`
- [ ] Auf dem Server: `npx prisma migrate deploy` (erstellt hh_messages Tabelle)
- [ ] Auf dem Server: `npm run build && pm2 restart hirehuman-api`

## 6. Testen nach Deploy
- [ ] `npx hirehuman-mcp --version` lokal testen (nach npm publish)
- [ ] `HIREHUMAN_MOCK_MODE=true npx hirehuman-mcp` — Mock-Modus testen
- [ ] In Claude Desktop: MCP-Config einfügen und Tools testen
- [ ] Conversations: Nachricht senden/empfangen über Agent + Human-Seite testen
- [ ] https://hirehumans.eu/agents/docs prüfen (npx-Anleitung sichtbar?)

## 7. Optional / Später
- [ ] Smithery Registry: Paket registrieren auf https://smithery.ai
- [ ] Identity Verification Backend (Stripe Identity) — Placeholder auf Frontend
- [ ] Phase 6: Security & DSGVO
