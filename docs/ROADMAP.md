# Smart Canteen - Incremental Milestone Roadmap

The Smart Canteen project is being developed step-by-step across 14 planned milestones (M0 through M13).

---

### M0 — Foundation + Design System [CURRENT]
* Clean monorepo structure (frontend, backend, database, docs)
* Shared TypeScript types, Tailwind CSS design tokens, reusable UI primitives
* Student placeholder dashboard (`/student`)
* Worker placeholder dashboard (`/worker`)
* Express backend foundation with `/health` endpoint
* Supabase connection service and health check UI component

### M1 — Student + Worker Authentication
* Supabase Auth integration (email/password, magic links, student ID)
* Role-based profile management (`student` vs `worker`)
* Protected routes & session management

### M2 — Menu + Food Management
* Dynamic menu categories & food items fetching
* Worker food management (add, edit, toggle availability)
* Image storage via Supabase Storage buckets

### M3 — Cart + Order Creation
* Client-side cart state management (add, remove, quantity controls)
* Subtotal calculation, tax, and convenience fees

### M4 — 15-Minute Pickup Slots + Capacity
* 15-minute time slot generation (e.g. 12:00-12:15, 12:15-12:30)
* Slot capacity tracking (e.g., 50 orders max per slot)
* Backend-enforced slot booking validation & full slot disabling

### M5 — Real-Time Student ↔ Worker Order Synchronization
* Supabase Realtime channel setup
* Live order status broadcasts from kitchen to student app

### M6 — Order Status + ETA
* Real-time ETA estimation algorithm
* Step-by-step order progress timeline (`Placed` -> `Preparing` -> `Ready` -> `Picked Up`)

### M7 — Online Payment + Digital Bill
* Payment gateway integration (Razorpay/Stripe mock/live integration)
* Digital invoice/receipt generation & PDF download

### M8 — 4-Digit OTP + Fast-Pass Pickup
* Automatic 4-digit OTP generation upon order readiness
* Worker OTP verification screen for fast-pass order handoff

### M9 — Food Demand Prediction
* Historical order analytics and preparation time forecasting
* Worker kitchen demand suggestions for peak hours

### M10 — Self-Order Kiosk
* Optimized full-screen kiosk layout for campus touchscreens
* Student QR scanning & instant order placement

### M11 — QR Wallet
* Student pre-funded digital canteen wallet
* QR code generation for quick balance scanning and payments

### M12 — Offline / Low-Network System
* Progressive Web App (PWA) offline service workers
* Local caching of menu items & offline queueing

### M13 — Final Integration + Testing
* End-to-end integration tests, load testing, security audits
* Final production deployment build
