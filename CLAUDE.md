# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nodegent is a campus-aware AI assistant for UCSC students (CSE 115A Spring 2026). It gives students a unified dashboard of their academic life (courses, assignments, deadlines) with an AI assistant that already knows their campus data, calendar sync, and full transparency over what the agent has done on their behalf.

**Release date:** 06/26/2026 | **Team:** 4–5 developers | **Sprints:** 4 × 2 weeks

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router + TypeScript (React Server Components where appropriate) |
| Hosting | Vercel |
| Database / Backend | Convex |
| Auth | Clerk (Google + campus SSO) |
| LMS Integration | Canvas API, MyUCSC (mock equivalents permitted where explicitly specified in release plan) |
| Calendar | Google Calendar API |
| AI/LLM | OpenAI / Anthropic (student's own subscription keys) |
| E2E Testing | Playwright |
| Future (backlog) | BrowserBase/BrowserUse for browser automation, MCP server/REST API |

## Sprint & User Story Map

### Sprint 1 – Planning, Research & Architecture (complete)
US-1.1 Release plan · US-1.2 Initial presentation · US-1.3 Architecture decisions · US-1.4 User research · US-1.5 Legal framework · US-1.6 Chat interface accessibility · US-1.7 Secure credential handling

### Sprint 2 – Core Infrastructure
US-2.1 Sign-in (Clerk) · US-2.2 Canvas/MyUCSC data fetch → Convex · US-2.3 Assignment dashboard · US-2.4 Database schema & data layer · US-2.5 Daily Snapshot view

### Sprint 3 – AI Assistant & Calendar Sync
US-3.1 Campus-aware AI chat · US-3.2 Google Calendar sync · US-3.3 New assignment notifications · US-3.4 Access toggle controls (LMS/SIS/calendar on/off)

### Sprint 4 – Polish, Guardrails & Demo Prep
US-4.1 Activity/audit log · US-4.2 Instant access revocation · US-4.3 Mobile-responsive UI · US-4.4 Onboarding documentation

**Backlog (out of scope for v1):** dining hall integration, gym occupancy, usage analytics, study schedule inference, multi-campus support, native mobile app, MCP server.

## Development Rules

### Scope Discipline
- Work on **one user story at a time**. Do not add features outside that story's scope.
- The Release Plan is the source of truth. Do not invent new stories, rename them, or re-assign sprint slots without explicit developer approval.
- If a prerequisite or refactor affects another story, **call it out and ask** before proceeding.

### No Fake Data
Do not hard-code arrays, dummy objects, or mock data purely to make the UI appear functional. Every story should wire end-to-end to the real backend or an **explicitly acknowledged** mock interface. If true integration isn't built yet, document it as an open task rather than hiding the gap behind fabricated data.

### 95% Certainty Rule
If unsure about a user story's intent, a technology's current best practice, or the security implications of a change, **pause and ask targeted questions** before implementing.

### Security & Credentials
- All secrets via environment variables — never hardcoded.
- Principle of least privilege for all OAuth scopes and tokens.
- Rate limiting and input validation at every external API boundary (Canvas, Google, LLM providers).
- Agent actions must be **logged and auditable** (see US-4.1).

## Build & Run Commands

```bash
npm install                # Install dependencies
npx convex dev             # Start Convex dev server (terminal 1)
npm run dev                # Start Next.js dev server with Turbopack (terminal 2)
npm run build              # Production build
npm run lint               # ESLint
npm run test:e2e           # Run Playwright E2E tests
npm run test:e2e:ui        # Playwright interactive UI mode
```

## Environment Setup

Copy `.env.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` from [Clerk Dashboard](https://dashboard.clerk.com)
- `NEXT_PUBLIC_CONVEX_URL` from `npx convex dev` (auto-populated)

## Key Architecture Decisions

- **Convex** owns all persistent state. The AI assistant reads campus data from Convex rather than holding credentials directly.
- **Clerk** handles auth; downstream API tokens (Canvas, Google Calendar) are stored server-side in Convex or environment secrets — never exposed to the client.
- **LLM calls** are made server-side (Next.js Route Handlers or Convex actions) so student API keys never touch the browser.
- Canvas/Google integrations are wrapped in audited server-side handlers; agent tool calls must be logged with timestamp, user identity, and action taken.
