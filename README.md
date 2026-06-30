# Printshop App

A simple application for myself to submit and manage print orders.

## Getting Started

### Prerequisites

- Node.js (14+)
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
3. Setup Workspace
	```bash
	pnpm run setup
	```

### Run

#### Development
```bash
pnpm start
```

#### Production
```bash
./start.sh
```
Or
```bash
sudo systemctl start printshop-app
```

## Project Structure

- / - backend
- /server.js - main server executable
- /setup.js - setup helper
- /orders - orders folder
- /sessions - stores user sessions
- /public/ - static assets
- /README.md - project README

## Contributing

Feel free to open issues or pull requests. Keep changes small and documented.
