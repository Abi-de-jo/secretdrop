# SecretDrop

SecretDrop is a modern, secure, and ephemeral secret-sharing web application built with **Next.js 15**, **React 19**, and **Tailwind CSS**.

---

## 🚀 Tech Stack

- **Framework:** [Next.js 15 (App Router)](https://nextjs.org/)
- **UI Library:** [React 19](https://react.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Linting & Formatting:** [ESLint](https://eslint.org/)
- **CI/CD:** [GitHub Actions](https://github.com/features/actions)

---

## 📁 Project Structure

```text
secretdrop/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI workflow
├── public/                    # Static assets
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── secrets/       # Secure SecretDrop API Routes
│   │   │       ├── route.ts   # POST /api/secrets (Create encrypted secret)
│   │   │       └── [id]/
│   │   │           ├── route.ts      # GET & DELETE /api/secrets/:id (Read/Burn)
│   │   │           └── meta/route.ts # GET /api/secrets/:id/meta (Query status)
│   │   ├── layout.tsx         # Root application layout
│   │   ├── page.tsx           # Home landing page
│   │   └── globals.css        # Global CSS & Tailwind imports
│   ├── lib/
│   │   ├── crypto/            # Zero-knowledge Web Crypto (AES-256-GCM & PBKDF2)
│   │   ├── security/          # Rate limiting, validation, & security headers
│   │   └── store/             # In-memory secret lifecycle & burn engine
│   └── middleware.ts          # Edge security headers & no-cache enforcement
├── tests/                     # Test suite (crypto, store, rate limiter, API routes)
├── next.config.ts             # Next.js configuration with strict CSP/HSTS headers
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Abi-de-jo/secretdrop.git
cd secretdrop
npm install
```

### Development Server

Run the development server with Turbopack:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 🔒 Security Architecture & Encryption

SecretDrop is built on a strict **zero-knowledge** model:

1. **Client-Side Encryption:**
   - Secrets are encrypted locally in the browser using **AES-256-GCM** via the Web Crypto API (`window.crypto.subtle`).
   - Passphrase protection uses **PBKDF2** (SHA-256 with 100,000 iterations and a 16-byte random salt).
   - Decryption keys are stored exclusively in the URL `#hash` fragment and never transmitted to the server over HTTP.

2. **Self-Destructing Data Lifecycle:**
   - **Burn-on-Read:** Secrets are atomically consumed and wiped from memory on retrieval.
   - **Configurable View Limits:** Multi-view secrets decrement atomically and burn when `remainingViews` reaches 0.
   - **Time-to-Live (TTL):** Automatic expiration (between 60 seconds and 7 days).
   - **Memory Scrubbing:** Expired records are continuously swept from memory.

3. **API Validation & Rate Limiting:**
   - Sliding-window IP rate limiting prevents DoS and brute-force attacks.
   - Strict payload validation enforces Base64URL encoding and a 1MB payload cap.

4. **Defense-in-Depth Security Headers:**
   - Strict Content Security Policy (`CSP`)
   - HTTP Strict Transport Security (`HSTS` with 2-year duration, subdomains, and preloading)
   - `Referrer-Policy: no-referrer` (prevents URL fragment and path leakage)
   - `X-Frame-Options: DENY` & `X-Content-Type-Options: nosniff`
   - Ephemeral cache control headers (`no-store, no-cache, must-revalidate, max-age=0`)

---

## 📡 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/secrets` | Store encrypted secret payload. Returns `{ id, expiresAt, maxViews, burnAfterRead }`. |
| `GET` | `/api/secrets/:id` | Retrieve and burn secret ciphertext. Returns 404 once burned or expired. |
| `DELETE` | `/api/secrets/:id` | Manually burn/destroy secret immediately. |
| `GET` | `/api/secrets/:id/meta` | Query secret metadata (status, expiration, view limit) without burning. |

---

## 🧪 Quality & Verification Scripts

- **Test Suite:**
  ```bash
  npm test
  ```
- **Type Checking:**
  ```bash
  npm run typecheck
  ```
- **Linting:**
  ```bash
  npm run lint
  ```
- **Production Build:**
  ```bash
  npm run build
  ```
- **Start Production Server:**
  ```bash
  npm run start
  ```

---

## 🚀 Continuous Integration

Automated CI workflows are configured in `.github/workflows/ci.yml`. On every push and pull request against `main`, `master`, and `develop`, the workflow performs:

1. Clean dependency installation (`npm ci`)
2. Static code linting (`npm run lint`)
3. TypeScript validation (`npm run typecheck`)
4. Unit & Security tests (`npm test`)
5. Next.js production build (`npm run build`)
