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
│   └── app/
│       ├── favicon.ico
│       ├── globals.css        # Global CSS & Tailwind imports
│       ├── layout.tsx         # Root application layout
│       └── page.tsx           # Home landing page
├── .gitignore
├── eslint.config.mjs          # ESLint configuration
├── next.config.ts             # Next.js configuration
├── package.json
├── postcss.config.mjs         # PostCSS configuration
├── README.md
└── tsconfig.json              # TypeScript configuration
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

## 🧪 Quality & Verification Scripts

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

## 🤖 Continuous Integration

Automated CI workflows are configured in `.github/workflows/ci.yml`. On every push and pull request against `main`, `master`, and `develop`, the workflow performs:

1. Clean dependency installation (`npm ci`)
2. Static code linting (`npm run lint`)
3. TypeScript validation (`npm run typecheck`)
4. Next.js production build (`npm run build`)
