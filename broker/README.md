# Broker

Der Broker stellt einen WebSocket-Endpunkt bereit, der eingehende Terminalverbindungen zu SSH-Sitzungen bridged.

## Quickstart

```bash
cp .env.example .env
npm install
node index.js
```

### Environment-Variablen

- `JWT_SECRET` oder `JWT_SECRET_B64` — muss mit dem Secret der PHP-API übereinstimmen
- `BROKER_PORT` — TCP-Port (Standard 3001)
- `BROKER_STATIC_*` — statische Zielhost-Konfiguration für lokale Tests

In der Produktion sollte der Broker die Host-Zugangsdaten nicht statisch halten, sondern sie über einen signierten Request an die PHP-API anfordern.
