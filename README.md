# Tobedone Backend

Express + TypeScript API with Socket.IO real-time, Neon PostgreSQL, and Drizzle ORM.

## Prerequisites

- Node.js 18+
- Neon PostgreSQL database

## Setup

1. Install dependencies:

```bash
cd backend
npm install
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Configure `.env`:

```env
DATABASE_URL=postgresql://user:password@host.neon.tech/tobedone?sslmode=require
JWT_SECRET=your-super-secret-jwt-key
PORT=3000
```

4. Push database schema:

```bash
npm run db:push
```

5. Start development server:

```bash
npm run dev
```

API runs at `http://localhost:3000`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/dashboard/home` | Home dashboard data |
| GET/POST | `/api/projects` | List/create projects |
| POST | `/api/projects/join` | Join via invite code |
| GET | `/api/projects/:id` | Project detail |
| POST/PATCH/DELETE | `/api/tasks` | Task CRUD |
| POST | `/api/tasks/:id/respond` | Accept/reject task |
| GET/POST/PATCH/DELETE | `/api/todos` | Personal todos |
| GET | `/api/messages/:groupId` | Paginated messages |
| POST | `/api/messages` | Send message |
| POST | `/api/messages/react` | Toggle reaction |
| GET | `/api/notifications` | List notifications |
| PATCH | `/api/notifications/read` | Mark one read |
| PATCH | `/api/notifications/read-all` | Mark all read |
| GET/PATCH | `/api/profile` | User profile |
| POST | `/api/upload` | File upload (multipart) |

## Socket.IO

- Path: `/api/socket`
- Auth: pass JWT via `auth.token` or `Authorization` header

### Client emit events

- `join:user` — subscribe to user notifications
- `join:discussion` — join chat room (groupId)
- `typing:start` / `typing:stop`
- `send:message`

### Server emit events

- `message:new`
- `message:reaction`
- `notification:new`
- `typing:start` / `typing:stop`

## Scripts

- `npm run dev` — development with hot reload
- `npm run build` — compile TypeScript
- `npm run start` — run production build
- `npm run db:push` — push schema to Neon
- `npm run db:studio` — Drizzle Studio
