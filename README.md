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

## Project Structure

- / - backend
- /server.js - main server executable
- /orders - orders folder
- /archive - completed orders are grouped by local date; after local midnight each day's folder is verified, compressed to `YYYY-MM-DD.tar.gz`, then removed. Missed days are processed when the server starts.
- /sessions - stores user sessions
- /public/ - static assets
- /README.md - project README

## Contributing

Feel free to open issues or pull requests. Keep changes small and documented.
