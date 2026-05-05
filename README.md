# Dokyuu Backend

> Real-time collaborative whiteboard API built with NestJS, MongoDB, and Socket.IO.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Roles & Permissions](#roles--permissions)
- [Docker](#docker)
- [Project Structure](#project-structure)

---

## Overview

Dokyuu Backend powers a real-time collaborative whiteboard platform. It handles user authentication, board management, canvas element persistence, file uploads via Cloudinary, and live multi-user collaboration through WebSockets.

Key capabilities:

- JWT-based authentication with profile management
- Board creation with auto-generated invite codes (member & reader roles)
- Canvas element persistence per board
- Real-time collaboration: cursor tracking, canvas sync, user presence, and host kick
- Image uploads to Cloudinary with automatic format/quality optimization

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| Database | MongoDB via Mongoose 9 |
| Authentication | Passport.js + JWT |
| Real-time | Socket.IO 4 |
| File Storage | Cloudinary |
| Validation | class-validator + class-transformer |
| Runtime | Node.js 20 |
| Containerization | Docker (multi-stage) |

---

## Architecture

The application is organized into independent NestJS modules:

```
AppModule
├── AuthModule       — Registration, login, profile updates, JWT strategy
├── BoardsModule     — Board CRUD, invite code generation
├── MembersModule    — Joining boards via invite codes
├── CanvasModule     — Element persistence (read / bulk save)
├── FilesModule      — Cloudinary image upload
└── SocketModule     — WebSocket gateway for real-time collaboration
```

**Data model relationships:**

```
User ──< BoardMember >── Board ──< BoardElement
                role: host | member | reader
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A running MongoDB instance
- A Cloudinary account

### Installation

```bash
git clone <repository-url>
cd dokyuu-backend
npm install
```

### Running in development

```bash
# Create your environment file
cp .env.example .env  # then fill in your values

npm run start:dev
```

The server starts on `http://localhost:3000` by default.

### Running tests

```bash
npm run test          # unit tests
npm run test:cov      # with coverage report
npm run test:e2e      # end-to-end tests
```

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Server
PORT=3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/dokyuu

# JWT
JWT_SECRET=your_jwt_secret_here

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## API Reference

All protected routes require the `Authorization: Bearer <token>` header.

### Auth — `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | No | Create a new account |
| `POST` | `/auth/login` | No | Login and receive a JWT |
| `PUT` | `/auth/profile` | Yes | Update display name and cursor color |

**Register / Login request body:**

```json
{
  "email": "user@example.com",
  "displayName": "Jane Doe",
  "password": "securepassword"
}
```

**Response:**

```json
{
  "access_token": "<jwt>",
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "displayName": "Jane Doe",
    "cursorColor": "#A3F1B2"
  }
}
```

---

### Boards — `/boards`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/boards` | Yes | Create a new board |
| `GET` | `/boards` | Yes | List all boards for the authenticated user |
| `PUT` | `/boards/:id` | Yes (host only) | Update board name or description |
| `DELETE` | `/boards/:id` | Yes (host only) | Delete board and all its data |

A new board response includes auto-generated `memberCode` and `readerCode` invite codes.

---

### Members — `/members`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/members/join` | Yes | Join a board using an invite code |

**Request body:**

```json
{ "code": "ABC-XYZ" }
```

The assigned role (`member` or `reader`) is determined automatically by which code was used.

---

### Canvas — `/canvas`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/canvas/:boardId/elements` | Yes (member) | Fetch all elements of a board |
| `PUT` | `/canvas/:boardId/elements` | Yes (host/member) | Bulk-replace all elements of a board |

---

### Files — `/files`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/files/upload` | Yes | Upload an image to Cloudinary |

Send the file as `multipart/form-data` with the field name `image`. Accepted formats: JPG, PNG, GIF, WEBP, SVG. Maximum size: 8 MB.

**Response:**

```json
{
  "message": "Imagen subida exitosamente",
  "url": "https://res.cloudinary.com/...",
  "publicId": "dokyuu/abc123",
  "width": 1920,
  "height": 1080
}
```

---

## WebSocket Events

Connect to the WebSocket server and authenticate via the handshake:

```js
const socket = io('http://localhost:3000', {
  auth: { token: 'Bearer <jwt>' }
});
```

### Emitted by client

| Event | Payload | Guard | Description |
|-------|---------|-------|-------------|
| `joinBoard` | `{ boardId }` | Auth | Join a board room |
| `canvas:update` | `{ boardId, elements[] }` | Auth + Role (host/member) | Broadcast canvas changes |
| `cursor:move` | `{ boardId, position: { x, y } }` | Auth | Broadcast cursor position |
| `kick:user` | `{ boardId, targetUserId }` | Auth | Remove a user from the room (host only) |

### Emitted by server

| Event | Payload | Description |
|-------|---------|-------------|
| `room:users` | `ConnectedUser[]` | Full updated user list for the room |
| `user:joined` | `{ userId, email, displayName, cursorColor }` | A new user joined |
| `user:left` | `{ userId, email, displayName }` | A user left or disconnected |
| `canvas:update` | `elements[]` | Canvas was updated by another user |
| `cursor:move` | `{ userId, displayName, cursorColor, position }` | Another user moved their cursor |
| `kicked` | `{ boardId, message }` | The current user was kicked by the host |

---

## Roles & Permissions

| Action | Host | Member | Reader |
|--------|:----:|:------:|:------:|
| View canvas | ✅ | ✅ | ✅ |
| Edit canvas | ✅ | ✅ | ❌ |
| Emit `canvas:update` via WebSocket | ✅ | ✅ | ❌ |
| Update board metadata | ✅ | ❌ | ❌ |
| Delete board | ✅ | ❌ | ❌ |
| Kick users | ✅ | ❌ | ❌ |

---

## Docker

The included `Dockerfile` uses a multi-stage build to produce a lean production image.

```bash
# Build the image
docker build -t dokyuu-backend .

# Run the container
docker run -p 3000:3000 --env-file .env dokyuu-backend
```

The production image contains only the compiled `dist/` output and production `node_modules`, keeping the image size minimal.

---

## Project Structure

```
src/
├── auth/                   # Authentication (JWT, guards, DTOs)
│   ├── dto/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   ├── jwt-auth.guard.ts
│   └── ws-auth.guard.ts
├── boards/                 # Board CRUD
│   ├── dto/
│   ├── boards.controller.ts
│   └── boards.service.ts
├── canvas/                 # Canvas element persistence
│   ├── canvas.controller.ts
│   └── canvas.service.ts
├── files/                  # Cloudinary uploads
│   ├── files.controller.ts
│   ├── files.service.ts
│   └── cloudinary.provider.ts
├── members/                # Invite-code join flow
│   ├── members.controller.ts
│   └── members.service.ts
├── schemas/                # Mongoose schemas
│   ├── user.schema.ts
│   ├── board.schema.ts
│   ├── board-member.schema.ts
│   ├── board-element.schema.ts
│   └── invitation.schema.ts
├── socket/                 # WebSocket gateway
│   ├── socket.gateway.ts
│   ├── socket.module.ts
│   └── ws-role.guard.ts
├── app.module.ts
└── main.ts
```

---

## License

This project is private and unlicensed — all rights reserved.
