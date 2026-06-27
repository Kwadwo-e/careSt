# Security Recommendations

- Replace the default super administrator password before use.
- Use a long random `JWT_SECRET`; never commit production secrets.
- Use HTTPS for VPS deployments.
- Use a private examination Wi-Fi network for LAN deployments.
- Limit PDF uploads by size and MIME type.
- Keep PostgreSQL accessible only to the application server.
- Back up PostgreSQL and `server/uploads` before and after examination sessions.
- Review failed login attempts and multiple-login audit records daily during an examination period.
- Assign each student a unique index number and do not share credentials.
- Keep the administrator laptop awake, encrypted, and physically supervised during LAN operation.
- Use least-privilege PostgreSQL credentials in production.
- Patch Node.js, PostgreSQL, and server operating systems regularly.
