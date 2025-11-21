# turingtest Backend (Node.js · ESM)

An Express-based REST API with JWT auth, MongoDB (Mongoose), Swagger UI (dev-only), rate limiting, CORS/Helmet hardening, and PM2 support.

## Features

* **ESM** (`"type": "module"`) with Node 18+ (tested on Node 22)
* **Express** API with centralized base middleware (`middlewares/Base.js`)
* **JWT** authentication guard (+ i18n messages)
* **MongoDB + Mongoose** with tuned pool/timeouts
* **Sessions** via `express-session` (in-memory by default for dev)
* **Swagger UI** (toggle via env; dev by default)
* **Rate limit** (per-IP)
* **CORS** + **Helmet**
* **Winston**-based logging
* **PM2** ecosystem config for dev/prod

---

##  Requirements

* Node.js **22+** 
* MongoDB (local or Atlas)

---

##  Getting Started

```bash
# 1) Install
npm install

# 2) Run (dev) on root
nodemon          

```

##  Environment

Create a `.env` file based on the following keys:

| Key | Description |
| --- | --- |
| `PORT` | API port (default 4000) |
| `MONGO_URI` | Connection string (e.g. `mongodb://127.0.0.1:27017`) |
| `MONGO_DB` | Database name (default `turingtest`) |
| `JWT_SECRETE_KEY` | Secret used to sign JWTs |
| `SESSION_SECRETE_KEY` | Secret for `express-session` |
| `SWAGGER_ENABLED` | `true` to enable `/api-docs` |
| `SWAGGER_HOST` | Base URL rendered in Swagger |
| `LLM_API_URL` | Optional URL of a real LLM provider (used for logging only in this test) |
| `LLM_API_TOKEN` | Optional API key placeholder for the simulated LLM call |

---

##  Domain Responsibilities

- **Users** authenticate via custom JWT auth. Passwords are hashed with Argon2 before persistence.
- **Chats** represent a conversation owned by a single user. Each chat stores `title`, owner reference, and last activity timestamps.
- **Messages** belong to a chat and are scoped to the owning user. Both user prompts and simulated assistant replies are persisted.
- **LLM Service** (`services/LLMService`) simulates an HTTP call to a third-party LLM provider with a randomized 10–20 second delay so that the async handling can be tested by the frontend without blocking other requests.

All business logic lives in the `managers/` layer. Controllers are thin, perform request validation (Joi), and delegate to managers. Swagger annotations sit next to the controller methods and are auto-discovered by `middlewares/Base.js`.

---

##  Authentication Approach

1. **Registration (`POST /auth/register`)**
   - Validates email/password with Joi.
   - Hashes the password with Argon2 (`utils/helpers.convertToHash`).
   - Stores the user in MongoDB and returns a JWT plus a sanitized user object.

2. **Login (`POST /auth/login`)**
   - Looks up the normalized email.
   - Uses Argon2 verification helpers to compare passwords.
   - Issues a JWT signed with `JWT_SECRETE_KEY` containing `{ id, email }`.

3. **Session Guard**
   - `middlewares/Base.authenticate` verifies the JWT on every request (except `/auth/login` and `/auth/register`) and exposes the decoded payload via `res.locals.decoded`.
   - Protected endpoints (chats, `/auth/me`) rely on this guard and never trust client-provided IDs.

4. **Ownership Enforcement**
   - `ChatManager.findOwnedChat` restricts access by validating that `chat.user` matches the authenticated user ID.
   - `Message` documents also record the user to prevent cross-tenant reads.

5. **API Documentation**
   - Swagger documents all auth and chat endpoints, including security requirements for JWTs.

---

##  Chat & LLM Flow

1. `POST /chats`
   - Creates a chat for the authenticated user.
   - Optional `message` field immediately triggers a simulated LLM exchange and persists both user + assistant messages.

2. `GET /chats`
   - Lists chats for the authenticated user ordered by the last update.

3. `GET /chats/{chatId}/messages`
   - Returns the chat metadata plus its messages (user and assistant) after verifying ownership.

4. `POST /chats/{chatId}/messages`
   - Saves the user prompt.
   - Delegates to `LLMService.generateReply`, which simulates an outbound HTTP call with headers/payload metadata and introduces a random 10–20 second asynchronous delay before returning a multi-sentence reply.
   - Persists the assistant response and returns both messages with delay metadata.

Because the delay is implemented with `timers/promises`, it does not block the Node.js event loop—other requests continue executing during the simulated LLM wait time.

---

##  Middleware Overview (Base.js)

##  Middleware Overview (Base.js)

* **Parsers:** `express.json()` / `express.urlencoded()`
* **Cookie/session:** `cookie-parser`, `express-session`
* **Static:** serves `public/`
* **CORS headers:** includes `Authorization`
* **Rate limit:** `express-rate-limit` (default 300/min)
* **JWT auth:** `Base.authenticate` with `express-unless` to bypass public routes
* **Swagger UI:** mounted only when `SWAGGER_ENABLED=true` or `NODE_ENV=development`

> **express-unless:** default import (`import unless from 'express-unless'`).
> **jsonwebtoken:** default import (`import jwt from 'jsonwebtoken'`).

---

## Mongo (Mongoose) Tuning

Implemented in `utils/mongoose.js`:

* **Pool:** `minPoolSize` / `maxPoolSize`
* **Timeouts:** server selection, socket, wait queue
* **Concerns:** `retryWrites`, `writeConcern`, `readConcern`
* **Compression:** `zstd` (if available)
* **Safety:** `strictQuery`, disable `autoIndex` in prod, `bufferCommands=false`

**Model best practices:**

* Define **indexes** matching your hot queries
* Use `.lean()` for reads, `.select()` to limit fields
* Consider keyset pagination vs `.skip()` for large collections
* Add `maxTimeMS()` for risky/long queries

---

 
