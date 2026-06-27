# Folder Structure

```text
CareApp/
  client/
    public/
      icons/
      manifest.webmanifest
      sw.js
    src/
      components/
      pages/
      services/
      App.jsx
      main.jsx
      styles.css
    Dockerfile
    index.html
    package.json
    vite.config.js
  database/
    migrations/
      001_init.sql
      002_relational_core_design.sql
  docs/
    api-endpoints.md
    architecture.md
    database-schema.md
    deployment.md
    folder-structure.md
    installation.md
    relational-database-design.md
    security.md
    wireframes.md
  server/
    src/
      config/
      middleware/
      routes/
      services/
      utils/
      index.js
    uploads/
    Dockerfile
    package.json
  .env.example
  docker-compose.yml
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  README.md
```

## Main Modules

- `client/src/pages`: student, academic supervisor, super administrator, and landing screens.
- `client/src/services/api.js`: REST client, JWT storage, PDF open/download helpers, Excel export helper.
- `server/src/routes`: REST endpoints for auth, student submission, supervisor review, admin control, and file access.
- `server/src/services`: audit logging, Excel export generation, and default admin creation.
- `database/migrations/001_init.sql`: full PostgreSQL schema for users, PDFs, submissions, settings, and audit logs.
