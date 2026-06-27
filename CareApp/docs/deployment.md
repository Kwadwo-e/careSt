# Deployment Guide

## VPS/Linux Server

1. Install Node.js, PostgreSQL, and a reverse proxy such as Nginx.
2. Clone or copy this project to the server.
3. Create `server/.env` with production values.
4. Run the database migrations:

```bash
npm run db:migrate
```

5. Build the frontend:

```bash
npm install
npm run build
```

6. Start the API with a process manager such as PM2 or systemd:

```bash
npm run start --workspace server
```

7. Serve `client/dist` from Nginx and proxy `/api` to the Express server. For a same-origin reverse proxy, build the frontend with `VITE_API_URL=/api`.

## Docker

Use `docker-compose.yml` for a production-like local stack:

```bash
docker compose up --build
```

The compose file starts PostgreSQL, the API, and the frontend container.

Fresh Docker databases load every file in `database/migrations` in filename order. The web container derives the API URL from the browser hostname by default, so `http://SERVER-IP:8080` calls `http://SERVER-IP:4000/api` unless `VITE_API_URL` is set at build time.

## LAN/Offline Exam Hosting

CareApp does not require internet access during an exam. The database, API, and frontend must run on the host machine, and student devices must stay connected to the same LAN/Wi-Fi. Use the QR code on the landing page to share the host address.

PWA installation and offline app-shell caching are controlled by browser secure-context rules. They work on `localhost` and HTTPS deployments; plain HTTP LAN addresses still run the app online over Wi-Fi but may not allow service worker installation on every browser.

## Windows Server

Install Node.js LTS and PostgreSQL, configure the same `.env`, run `npm run db:migrate`, then run the server through a Windows service manager such as NSSM.
