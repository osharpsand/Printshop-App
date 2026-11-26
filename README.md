# Printshop App

A simple application for myself to submit and manage print orders.

## Getting Started

### Prerequisites

- Node.js (22+)
- NVM
- pnpm

### Install

1. Clone the repository
	```bash
	git clone https://github.com/osharpsand/Printshop-App.git
	cd Printshop-App
	```
2. Install dependencies
	```bash
	pnpm install
	```

### Run

```bash
pnpm start
```

In development, the server automatically creates a self-signed certificate in `/cert` and serves HTTPS directly at `https://localhost:3000` (or the configured `PORT`). Browsers will warn that the certificate is not trusted; this certificate is for local development only, and HSTS is disabled in development. In production, set `PRODUCTION=true` and terminate TLS at a trusted reverse proxy; HTTP requests will be redirected to the configured `DOMAIN`.

## Project Structure

- / - backend
- /server.js - main server executable
- /orders - orders folder
- /archive - completed orders are grouped by local date; after local midnight each day's folder is verified, compressed to `YYYY-MM-DD.tar.gz`, then removed. Missed days are processed when the server starts.
- /sessions - stores user sessions
- /cert - stores automatically generated, ignored development TLS certificates
- /public/ - static assets
- /README.md - project README

## Contributing

Feel free to open issues or pull requests. Keep changes small and documented.
