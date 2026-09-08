# Smart Canteen - System Architecture & Design Principles

## Overview
Smart Canteen is an incremental, modular, full-stack food pre-ordering and canteen operations system. It provides two distinct user experiences sharing a unified design system and backend:

1. **Student Experience**: Mobile-first consumer app focusing on food discovery, 15-minute pickup slot selection, online payment, live order tracking, and 4-digit OTP verification.
2. **Worker Experience**: High-density operational interface focusing on incoming order management, kitchen queue processing, slot preparation summary, and OTP verification at pickup.

## System Architecture Diagram

```
+-----------------------------------------------------------------------+
|                             FRONTEND                                  |
|  +----------------------------------+ +----------------------------+  |
|  |       Student Interface          | |      Worker Interface      |  |
|  |          (/student)              | |          (/worker)         |  |
|  +----------------------------------+ +----------------------------+  |
|                                  \       /                            |
|                       Shared Component & Design System                 |
|                       (Tokens, Buttons, Cards, Modals)                |
+-----------------------------------+-----------------------------------+
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
+-------------------------------+   +-------------------------------+
|         BACKEND API           |   |       SUPABASE SERVICE        |
|      (Node.js + Express)      |   | (PostgreSQL + Realtime + Auth)|
|  - Health checks              |   | - Shared DB tables            |
|  - Slot capacity enforcement  |   | - Row Level Security (RLS)    |
|  - Business rules & OTP       |   | - Realtime Order Subscriptions|
+-------------------------------+   +-------------------------------+
```

## Architectural Principles

1. **Modular Decoupling**: Student and Worker interfaces are separated visually and structurally. Components and services are broken down cleanly so feature updates in Student do not break Worker code.
2. **Shared Supabase Database**: Both interfaces share ONE single Supabase PostgreSQL instance. Role-based permissions isolate Student actions from Worker actions.
3. **Backend-Enforced Capacity**: Pickup slot limits (e.g. 50 orders / 15-minute slot) are managed and enforced server-side/database-side to prevent overbooking race conditions.
4. **Restrained, Commercial UI**: Clean modern typography, high contrast readability, Slate neutral palettes, subtle borders, mobile-first responsive layouts.
