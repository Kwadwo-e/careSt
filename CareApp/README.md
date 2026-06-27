# OWBRHE Care Study Submission

A full-stack Progressive Web App for student care-study PDF submission, academic supervisor review, super-administrator control, Excel exports, and audit logging.

The app follows the requested stack:

- React PWA frontend
- Node.js + Express REST API
- PostgreSQL relational database
- JWT authentication
- PDF upload/view/download controls
- Excel export for submitted care studies
- LAN/local hosting and VPS/Docker deployment support

## Quick Start

1. Install Node.js 20+, PostgreSQL 15+, and npm 10+.
2. Copy `server/.env.example` to `server/.env` and update secrets/database settings.
3. Install dependencies:

```bash
npm install
```

4. Create the database:

```bash
createdb careapp
```

5. Run the database migrations:

```bash
npm run db:migrate
```

6. Start both frontend and backend:

```bash
npm run dev
```

7. Open the frontend:

```text
http://localhost:5173
```

The backend API runs on:

```text
http://localhost:4000/api
```

## PWA and Platform Support

CareApp includes a web app manifest, standard PNG install icons, an Apple touch icon, mobile app metadata, and a service worker that caches the app shell and built frontend assets. It is designed for modern Chrome, Edge, Safari, and Firefox on Windows, macOS, iOS/iPadOS, and Android.

The app can be installed as a PWA where the browser supports installation. Service workers require a secure browser context, so offline app-shell caching works on `localhost` during development and on HTTPS deployments. During LAN exams over `http://SERVER-IP`, student devices can still use the app through the Wi-Fi network without internet access, but the backend server and database must stay running on the host computer.

## Local Demo Mode

If PostgreSQL is not installed yet, use the local development backend. It stores demo data in `server/data/local-dev-db.json` and keeps uploads in `server/uploads`.

Terminal 1:

```bash
cd server
node src/local-dev-server.js
```

Terminal 2:

```bash
cd client
npm run dev -- --host 0.0.0.0
```

Then open `http://localhost:5173`.

Default super administrator:

- Username: `superadmin`
- Password: `ChangeMeNow!2026`

Student and supervisor registrations start as `pending`. The super administrator must accept them before they can log in. A student also needs to be assigned to a supervisor, and the supervisor must accept that student before the student can log in and submit.

## Default Super Administrator

On first backend startup, the server creates a super administrator if no admin exists.

- Username: value of `DEFAULT_ADMIN_USERNAME`
- Password: value of `DEFAULT_ADMIN_PASSWORD`

Change the default password immediately after first login in a production deployment.

## LAN Examination Hosting

1. Connect the administrator laptop and student devices to the same Wi-Fi/LAN.
2. Start PostgreSQL and the API on the administrator laptop.
3. Start the frontend with a host binding:

```bash
npm run dev --workspace client -- --host 0.0.0.0
```

4. Students browse to the address shown by the QR code or enter:

```text
http://SERVER-IP:5173
```

When `VITE_API_URL` is not set, the frontend automatically calls the API on the same hostname at port `4000`, for example `http://SERVER-IP:4000/api`. Set `CLIENT_ORIGIN` in `server/.env` to the LAN frontend address when running in production mode; comma-separated values are supported.

## How to Build the Windows Installer

The easiest method is to let GitHub Actions build the Windows installer for you.

### Build With GitHub Actions

1. Put this `CareApp` folder in a GitHub repository.
2. Open the repository on GitHub.
3. Click the `Actions` tab.
4. Click `Build Windows Installer`.
5. Click `Run workflow`, then click the green `Run workflow` button.
6. Wait for the workflow to finish.
7. Open the completed workflow run.
8. Scroll to `Artifacts`.
9. Download `CareApp-Windows-Installer`.
10. Unzip the downloaded artifact.
11. Run `CareApp-Windows-Setup.exe` on the Windows computer.

The workflow uses a Windows runner. It installs Node.js, npm dependencies, Python, PyInstaller, and Inno Setup. It builds the React frontend, prepares the local backend package, bundles a portable Windows Node.js runtime, creates `CareApp.exe` from `server.py`, builds the Windows installer, and uploads the installer as a downloadable artifact.

### Build Locally On Windows

Install these first:

- Node.js 20 LTS from `https://nodejs.org/`
- Python 3.11 or newer from `https://www.python.org/downloads/windows/`
- Inno Setup 6 from `https://jrsoftware.org/isinfo.php`

Then open PowerShell in the `CareApp` project folder and run this exact command:

```powershell
powershell -ExecutionPolicy Bypass -File packaging\windows\build-installer.ps1
```

When it finishes, the installer will be here:

```text
release\windows\installer\CareApp-Windows-Setup.exe
```

The installed Windows app uses the local demo backend, stores records in `server\data`, stores uploaded PDFs in `server\uploads`, and opens in the browser at `http://127.0.0.1:4000/`.

`server.py` is the Windows launcher used by PyInstaller. It starts the bundled Node.js backend at `server\src\local-dev-server.js` and opens CareApp in the browser.

## Documentation

- [System architecture](docs/architecture.md)
- [Database schema](docs/database-schema.md)
- [Relational database design](docs/relational-database-design.md)
- [Folder structure](docs/folder-structure.md)
- [API endpoints](docs/api-endpoints.md)
- [UI wireframes](docs/wireframes.md)
- [Installation guide](docs/installation.md)
- [Deployment guide](docs/deployment.md)
- [Security recommendations](docs/security.md)
