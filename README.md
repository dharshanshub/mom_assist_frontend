# Frontend — MoM Assist Chat UI

React + Vite + TypeScript, served in production by Nginx.

## Local dev (without Docker)

```bash
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

The Vite dev server proxies `/api` → `http://localhost:8000`.

## Build

```bash
npm run build      # output in dist/
```
