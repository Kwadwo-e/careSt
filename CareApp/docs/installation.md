# Installation Guide

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 15 or newer
- Modern browser: Chrome, Edge, Safari, or Firefox on Windows, macOS, iOS/iPadOS, or Android

## Steps

1. Copy `server/.env.example` into `server/.env`.
2. Set `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, and default admin credentials.
3. Install dependencies:

```bash
npm install
```

4. Create a PostgreSQL database.
5. Run the migrations:

```bash
npm run db:migrate
```

6. Start development servers:

```bash
npm run dev
```

7. Open `http://localhost:5173`.

## Local/LAN Examination Setup

Run the backend and database on the administrator laptop. Start Vite with `--host 0.0.0.0`, then give candidates the administrator laptop's LAN address, such as:

```text
http://192.168.1.10:5173
```

Use a stable Wi-Fi network and keep the administrator laptop awake for the full examination window.

The frontend automatically calls the API on the same hostname at port `4000` when `VITE_API_URL` is not set. A phone that opens `http://192.168.1.10:5173` will therefore call `http://192.168.1.10:4000/api`.

No internet access is required during exams after the app dependencies are installed and the server is running. PWA installation and offline app-shell caching are available where the browser permits service workers; browsers generally require `localhost` or HTTPS for service workers.
