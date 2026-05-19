# Trelk Support Dashboard

Agent workspace for the Trelk Support Platform — a React 19 + TypeScript SPA that connects to the backend API over REST and Socket.IO.

## Tech Stack

| | |
|---|---|
| Framework | React 19, TypeScript 5 |
| Build | Vite 7 + SWC (esbuild for production) |
| Routing | React Router v7 (lazy-loaded routes) |
| State | Zustand stores |
| Data fetching | TanStack Query v5 |
| Real-time | Socket.IO client |
| UI | Tailwind CSS v4, Lucide icons |
| Charts | Recharts |
| Flows | ReactFlow v11 |
| i18n | react-i18next |

## Getting Started

```bash
cd dashboard
cp .env.example .env
npm install
npm run dev
```

The dev server starts on `http://localhost:5175` and proxies `/api`, `/socket.io` and `/webchat-socket` to the backend.

## Environment Variables

See [`.env.example`](./.env.example).

| Variable | Description |
|---|---|
| `VITE_API_URL` | Override backend URL (empty = use Vite proxy) |

## Build

```bash
npm run build   # outputs dist/
npm run preview # preview the production build
```

Production build drops all `console.*` calls via esbuild and splits vendor chunks automatically.

## Architecture Notes

- **Lazy routes** — every page component is code-split via `React.lazy()`. Only the shell (`DashboardLayout`) loads eagerly.
- **Zustand stores** — one store per domain: `authStore`, `chatStore`, `agentsStore`, `settingsStore`, etc.  
- **Socket.IO** — `services/socket.ts` singleton manages the dashboard connection; `services/webchat.service.ts` handles the widget namespace.
- **RBAC** — `usePermissions()` hook + `<ProtectedRoute permission="...">` gate every sensitive route.
- **TanStack Query** — used for server-state that benefits from caching (contacts, audit logs, exports). Real-time state stays in Zustand.
