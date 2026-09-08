# Smart Canteen Prototype

> A modern, mobile-first food pre-ordering and canteen queue management application built for high-throughput campus food courts.

---

## 1. Project Purpose

Smart Canteen solves peak-hour canteen congestion, long physical queues, and unpredictable order preparation delays by providing:
- **Student Pre-Ordering**: Select items, reserve 15-minute pickup slots, pay online, track live preparation status, and present a 4-digit OTP at pickup.
- **Worker Kitchen Operations**: Operational high-density queue management, slot preparation tracking, and fast-pass OTP verification.
- **Self-Order Kiosks & Wallet**: Integrated touch-screen kiosk ordering and pre-funded QR canteen wallet.

---

## 2. Current Milestone: Milestone 0 (Foundation + Premium Design System)

> [!IMPORTANT]
> **This repository is currently at Milestone 0.**
> Only technical architecture, reusable design system primitives, routing placeholders for `/student` and `/worker`, backend health check, database schema migrations, and Supabase client configuration are implemented.
> **No business logic (ordering, payments, slot capacity booking, OTP generation, offline mode, AI prediction, or kiosk) has been implemented yet.**

---

## 3. Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript & Vite
- **Styling**: Tailwind CSS v3 with custom design system tokens
- **Icons**: Lucide React
- **Database Client**: `@supabase/supabase-js`

### Backend
- **Runtime**: Node.js + Express
- **Language**: TypeScript (`tsx` dev runner & `tsc` build tool)
- **Middleware**: CORS & custom error handler

### Database / Backend Services
- **Database**: Supabase (PostgreSQL) shared between Student & Worker experiences
- **Migrations**: SQL DDL schema files (`database/migrations/`)

---

## 4. Project Structure

```
smart-canteen/
├── frontend/                          # Vite + React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── student/                   # Student experience views & layouts
│   │   ├── worker/                    # Worker/Kitchen operations experience
│   │   ├── shared/                    # Shared design system & UI primitives
│   │   │   ├── components/            # Button, Input, Card, Header, BottomNav, etc.
│   │   │   ├── health/                # Supabase & Backend connection cards
│   │   │   └── design-system/         # Color, font & spacing tokens
│   │   ├── services/                  # Supabase & Express API clients
│   │   ├── types/                     # Shared TypeScript types
│   │   └── config/                    # Environment configuration
│   ├── .env.example
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
├── backend/                           # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/                    # Env configuration
│   │   ├── routes/                    # API routes (GET /health)
│   │   ├── middleware/                # CORS & Error middleware
│   │   └── server.ts                  # Server entry point
│   ├── .env.example
│   ├── tsconfig.json
│   └── package.json
├── database/
│   └── migrations/
│       └── 001_initial_schema.sql     # Shared Supabase PostgreSQL migration schema
├── docs/
│   ├── ARCHITECTURE.md                # System design & component relations
│   └── ROADMAP.md                     # Milestones M0 to M13
├── .env.example                       # Root global environment example
├── package.json                       # Root script orchestrator
└── README.md                          # Milestone 0 Documentation
```

---

## 5. Setup Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Initial Installation

```bash
# Clone the repository
git clone https://github.com/your-org/smart-canteen.git
cd smart-canteen

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

# Return to root
cd ..
```

---

## 6. Environment Variables

Create `.env` files based on the `.env.example` templates provided in both `frontend/` and `backend/`.

### Frontend (`frontend/.env`)
```env
VITE_SUPABASE_URL=https://your-supabase-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
VITE_BACKEND_URL=http://localhost:5000
```

### Backend (`backend/.env`)
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

---

## 7. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Open `database/migrations/001_initial_schema.sql` from this repository and run the script.
4. Copy your project **URL** and **anon / public key** from Project Settings -> API into `frontend/.env`.

---

## 8. How to Run Frontend

```bash
# From the root directory:
npm run dev:frontend

# Or inside the frontend directory:
cd frontend
npm run dev
```

The frontend will start at `http://localhost:5173`.

---

## 9. How to Run Backend

```bash
# From the root directory:
npm run dev:backend

# Or inside the backend directory:
cd backend
npm run dev
```

The Express API server will start at `http://localhost:5000`. You can test the health endpoint by visiting `http://localhost:5000/health`.

---

## 10. Student vs Worker Architecture

- **Student Interface (`/student`)**: Mobile-first consumer flow designed for quick browsing, category filtering, pickup slot selection, online payment, live status tracking, and 4-digit OTP presentation.
- **Worker Interface (`/worker`)**: Desktop/tablet optimized high-density dashboard focusing on kitchen queue velocity, status transitions (`Placed` -> `Preparing` -> `Ready`), slot capacity monitoring, and OTP verification.
- **Shared Layer**: Both interfaces consume the SAME design tokens (`tokens.ts`), shared UI primitives (`Button`, `Card`, `Input`, `StatusBadge`), and communicate with the SAME Supabase PostgreSQL database.

---

## 11. Design Principles

1. **Restrained Commercial Aesthetic**: Modern Slate palette (`#0f172a`, `#1e293b`), Emerald (`#10b981`) for ready/success states, Amber (`#f59e0b`) for active/kitchen states.
2. **No AI Gimmicks**: Avoid neon glows, excessive glassmorphism, decorative AI art, robot icons, or unnecessary chart clutter.
3. **Mobile-First Layout**: Clean touch targets, custom smooth scrollbars, subtle 1px border hierarchy.

---

## 12. Future Milestone Roadmap

* **M0 — Foundation + Design System** *(Completed)*
* **M1 — Student + Worker Authentication**
* **M2 — Menu + Food Management**
* **M3 — Cart + Order Creation**
* **M4 — 15-Minute Pickup Slots + Capacity**
* **M5 — Real-Time Student ↔ Worker Order Synchronization**
* **M6 — Order Status + ETA**
* **M7 — Online Payment + Digital Bill**
* **M8 — 4-Digit OTP + Fast-Pass Pickup**
* **M9 — Food Demand Prediction**
* **M10 — Self-Order Kiosk**
* **M11 — QR Wallet**
* **M12 — Offline / Low-Network System**
* **M13 — Final Integration + Testing**
