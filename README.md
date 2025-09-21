# ServerManager Web

ServerManager ist eine modulare Plattform für SSH/RDP-Zugriff, Snippet-Ausführung und Dokumentation im Browser. Dieses Repository enthält die PHP-basierte API, das statische Frontend und einen Node.js-Broker für WebSocket- und SSH-Bridging.

## Struktur

```
app/            # PHP Namespaces (Controllers, Security, Datenbank-Repositories)
api/            # Slim Front-Controller für die REST-API
public/         # Statisches Frontend (Tailwind CDN + Vanilla JS)
broker/         # Node.js Sidecar (WebSocket -> SSH)
```

## Voraussetzungen

- PHP 8.2 oder höher mit `ext-sodium`
- Composer 2
- Node.js 18+
- MySQL/MariaDB laut Schema im Projektplan

## Schnellstart (Entwicklung)

1. `.env` aus `.env.example` kopieren und Werte setzen
2. `broker/.env` aus `broker/.env.example` erstellen
3. Abhängigkeiten installieren
   ```bash
   composer install
   cd broker && npm install
   ```
4. PHP API via Built-in Server starten
   ```bash
   php -S 127.0.0.1:8080 -t public api/index.php
   ```
5. Broker starten (nutzt `.env`)
   ```bash
   cd broker
   node index.js
   ```

> **Hinweis:** Für den Broker sind derzeit statische Zugangsdaten via Environment-Variablen vorgesehen (`BROKER_STATIC_*`). Die Integration zum sicheren Abruf aus der PHP-API erfolgt in einer späteren Iteration.

## API-Routen (Auszug)

- `POST /auth/login` — Anmeldung mit E-Mail/Passwort und optional TOTP
- `POST /auth/refresh` — Access-Token rotieren via Refresh-Cookie
- `POST /auth/logout` — Aktuelle Session invalidieren
- `POST /auth/enable-2fa` — TOTP aktivieren/deaktivieren
- `GET /hosts` — Zugängliche Hosts der angemeldeten Person
- `GET /hosts/{id}/token` — Kurzlebiges JWT für den Broker

## Sicherheit

- Passwörter mit Argon2id (nicht im Code, aber zwingende Vorgabe)
- JWT (`HS256`) mit kurzlebigen Tokens (`ACCESS_TOKEN_TTL`)
- Refresh-Token werden gehasht in der Datenbank abgelegt
- Sensitive Daten sollen mittels `App\Security\Crypto` (sodium) verschlüsselt werden

## Nächste Schritte

- API-Endpunkte für CRUD-Operationen erweitern (Hosts, Snippets, Docs, IPAM)
- Broker um SFTP und kollaboratives Session-Sharing ergänzen
- RBAC/ACL-Checks vollständiger implementieren
- Guacamole/RDP-Anbindung integrieren

