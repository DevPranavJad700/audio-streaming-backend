# 🎵 RBAS — Role-Based Audio Streaming Backend

[![Node.js](https://img.shields.io/badge/Node.js-v22-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-v5.2-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%20v9-brightgreen.svg)](https://mongoosejs.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![OpenAPI](https://img.shields.io/badge/Swagger-OpenAPI%203.0-orange.svg)](http://localhost:3000/api-docs)
[![Test Coverage](https://img.shields.io/badge/Coverage-78%25%20(66%20passing)-success.svg)]()

An enterprise-ready, production-grade **Role-Based Audio Streaming & Music Management API** built with Express 5, MongoDB, ImageKit Cloud Storage, Winston logging, and comprehensive OpenAPI 3.0 documentation.

---

## 🌟 Key Highlights

- **Express 5 Architecture**: Modern async pipeline with in-place sanitization, compression, and robust error handling.
- **Role-Based Access Control (RBAC)**: Strict role separation between listeners (`user`) and creators (`artist`).
- **Dual Authentication**: Seamless token extraction from **httpOnly secure cookies** OR **`Authorization: Bearer <token>` header** (ready for mobile apps, SPAs, and Swagger UI).
- **Enterprise Token Lifecycle**:
  - Short-lived access tokens (15m) paired with opaque cryptographically random refresh tokens (7d).
  - SHA-256 hashed refresh tokens stored in MongoDB with automatic TTL index deletion.
  - Strict Token Rotation on refresh: single-use refresh tokens prevent replay and session hijacking.
  - Session revocation across all devices on password reset or logout.
- **OWASP Security Hardened**:
  - `helmet` security headers with CSP config for Swagger UI.
  - Express 5-compatible NoSQL injection sanitization (`mongoSanitize.sanitize`).
  - Granular route-level rate limiting: Brute-force protection on auth endpoints without impacting public discovery.
  - Multi-origin CORS support with credentials for multi-environment deployments.
  - Password hashing via `bcryptjs` (salt rounds: 10).
  - Anti-enumeration protection on password recovery.
- **Media & Cloud Storage Hygiene**:
  - Audio uploads (MP3, MP4, WAV, OGG, FLAC) via ImageKit with automated cloud file deletion on track removal.
  - Cover art image uploads (JPEG, PNG, WebP) for albums with automated cleanup on deletion.
  - Track ownership verification ensuring artists can only add their own tracks to albums.
- **Reliability & Observability**:
  - Dual-transport Winston logger (structured file rotation + colored dev console).
  - Morgan HTTP traffic auditing piped to Winston stream.
  - Graceful process shutdown handling `SIGINT` and `SIGTERM`.
  - Comprehensive Jest + SuperTest automated test suite (**66 tests, 100% passing, ~79% coverage**).
- **Containerization**: Multi-stage production `Dockerfile` (Node 22 Alpine, non-root user) and `docker-compose.yml` with MongoDB health checks.
- **Interactive Documentation**: Built-in Swagger UI served live at `/api-docs`.

---

## 📐 System Architecture

```
                    ┌────────────────────────┐
                    │     Client Request     │
                    └───────────┬────────────┘
                                │
        ┌───────────────────────▼────────────────────────┐
        │  Global Security: Helmet, CORS, Compression   │
        │  Rate Limiting, Morgan Logging, CookieParser   │
        │  NoSQL Injection In-place Sanitization         │
        └───────────────────────┬────────────────────────┘
                                │
          ┌─────────────────────┴─────────────────────┐
          │                                           │
  /api/auth Routes                            /api/music Routes
  ├── POST /register                          ├── GET  / (Browse tracks)
  ├── POST /login                             ├── GET  /:id (Track details)
  ├── POST /refresh (Token Rotation)          ├── POST /upload (Artist only)
  ├── POST /logout                            ├── GET  /my-uploads (Artist only)
  ├── GET  /me                                ├── PATCH/:id (Track owner)
  ├── POST /forgot-password                   ├── DEL  /:id (Track owner)
  ├── POST /reset-password                    ├── POST /albums (Artist + Cover Art)
  ├── GET  /artists                           ├── GET  /albums (Browse albums)
  └── GET  /profile/:userId                   ├── GET  /my-albums (Artist only)
                                              ├── GET  /albums/:id
                                              ├── PATCH/albums/:id (Album owner)
                                              └── DEL  /albums/:id (Album owner)
```

---

## 🔐 RBAC Permissions Matrix

| Endpoint | Method | Role Allowed | Description |
|---|---|---|---|
| `/api/auth/register` | POST | Public | Create new listener or artist account |
| `/api/auth/login` | POST | Public | Authenticate and obtain JWT cookies |
| `/api/auth/refresh` | POST | Public | Exchange refresh token cookie for new access token |
| `/api/auth/logout` | POST | Public | Clear cookies and revoke refresh token in DB |
| `/api/auth/me` | GET | `user`, `artist` | View authenticated account profile |
| `/api/auth/forgot-password`| POST | Public | Request password reset email |
| `/api/auth/reset-password` | POST | Public | Set new password with reset token |
| `/api/auth/artists` | GET | Public | Paginated search of platform artists |
| `/api/auth/profile/:userId`| GET | Public | View public profile & artist discography |
| `/api/music` | GET | `user`, `artist` | Paginated search and browse music |
| `/api/music/:musicId` | GET | `user`, `artist` | Fetch single track with artist details |
| `/api/music/upload` | POST | `artist` | Upload new audio track (up to 50MB) |
| `/api/music/my-uploads` | GET | `artist` | View artist's own uploaded tracks |
| `/api/music/:musicId` | PATCH | `artist` (Owner) | Edit audio title |
| `/api/music/:musicId` | DELETE | `artist` (Owner) | Delete track and cascade remove from albums |
| `/api/music/albums` | POST | `artist` | Create album with tracklist & optional cover art |
| `/api/music/albums` | GET | `user`, `artist` | Paginated album catalogue |
| `/api/music/my-albums` | GET | `artist` | View albums created by authenticated artist |
| `/api/music/albums/:albumId`| GET | `user`, `artist` | Fetch album with populated track metadata |
| `/api/music/albums/:albumId`| PATCH | `artist` (Owner)| Update album title, tracks, or cover art |
| `/api/music/albums/:albumId`| DELETE | `artist` (Owner)| Delete album and clean up ImageKit cover art |
| `/api-docs` | GET | Public | Interactive Swagger API documentation |
| `/health` | GET | Public | Healthcheck and server uptime |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- MongoDB Atlas or local MongoDB instance
- ImageKit.io account (for audio and cover art media storage)

### 2. Installation
```bash
git clone <repository-url>
cd RBAS
npm install
```

### 3. Environment Setup
Copy the example environment file and configure your credentials:
```bash
cp .env.example .env
```

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | HTTP server port | `3000` |
| `NODE_ENV` | Environment mode (`development` / `production` / `test`) | `development` |
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret key for access token signing (min 32 chars) | `your_secret_key` |
| `IMAGEKIT_PRIVATE_KEY`| ImageKit Private API key | `private_xxxx...` |
| `CLIENT_URL` | Frontend origin for CORS whitelist | `http://localhost:5173` |
| `SMTP_HOST` | (Optional) SMTP mail server host | `smtp.mailgun.org` |
| `SMTP_PORT` | (Optional) SMTP port | `587` |
| `SMTP_USER` | (Optional) SMTP username | `postmaster@...` |
| `SMTP_PASS` | (Optional) SMTP password | `xxxx` |

### 4. Running the Application

#### Option A: Local Development
```bash
# Start in development mode with nodemon
npm run dev

# Start in production mode
npm start
```

#### Option B: Containerized with Docker Compose (Recommended)
```bash
# Spin up both RBAS Backend and MongoDB with a single command
docker compose up --build -d
```

Once started, open:
- **API Documentation**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

---

## 🧪 Testing

The test suite runs with Jest and SuperTest with mocked MongoDB and ImageKit storage — no live database or cloud account required to run tests.

```bash
# Run all tests
npm test

# Run tests with code coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

---

## 📁 Project Structure

```
RBAS/
├── logs/                         # Winston error & combined log files
├── src/
│   ├── app.js                    # Express app configuration & middleware pipeline
│   ├── controllers/
│   │   ├── auth.controller.js    # Auth, password reset & profile endpoints
│   │   └── music.controller.js   # Audio & album CRUD operations
│   ├── db/
│   │   └── db.js                 # Mongoose connection with error handling
│   ├── docs/
│   │   └── swagger.js            # OpenAPI 3.0 specification definition
│   ├── middlewares/
│   │   ├── auth.middleware.js    # Dual auth verification (cookies + Bearer header)
│   │   ├── rateLimiter.middleware.js # Global & granular auth rate limiters
│   │   └── validate.middleware.js# Express-validator error handler
│   ├── models/
│   │   ├── album.model.js        # Album schema with coverArt & index
│   │   ├── music.model.js        # Music schema with text index & fileId
│   │   ├── passwordResetToken.model.js # SHA-256 tokens with MongoDB TTL
│   │   ├── refreshToken.model.js # Rotation tokens with MongoDB TTL
│   │   └── user.model.js         # User schema with compound indexes
│   ├── routes/
│   │   ├── auth.routes.js        # Auth, recovery, and profile routes
│   │   └── music.routes.js       # Music and album routes
│   ├── services/
│   │   ├── email.service.js      # Nodemailer service with test fallback
│   │   └── storage.service.js    # ImageKit upload & deletion client
│   ├── utils/
│   │   ├── logger.js             # Winston structured logging configuration
│   │   └── pagination.js         # Standardized pagination helper
│   └── validators/
│       ├── auth.validator.js     # Auth, login & password recovery rules
│       └── music.validator.js    # Music, album & pagination rules
├── tests/
│   ├── auth.test.js              # Authentication, recovery & system tests
│   └── music.test.js             # Music, album, cover art & upload tests
├── .dockerignore                 # Docker build exclusion rules
├── .env.example                  # Environment configuration template
├── .gitignore                    # Git ignore file
├── docker-compose.yml            # Docker Compose orchestration
├── Dockerfile                    # Multi-stage production container image
├── jest.config.js                # Jest test runner settings
├── package.json                  # Dependencies & scripts
└── server.js                     # Process bootstrap & graceful shutdown
```

---

## 🛡️ License

ISC License. Built for high performance, reliability, and security.
