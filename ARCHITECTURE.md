# JEJU CODA — Architecture

## Overview

JEJU CODA is an educational assessment platform built on Base44 with a Supabase-first data architecture for core learning features. This document describes the current architecture, data sources, and authentication flow.

## Authentication

### Source: Supabase (custom auth)

- **Student/Parent/Admin login**: `appLogin` backend function
  - Uses `app_users` table in Supabase
  - Passwords hashed with PBKDF2-SHA256 (Web Crypto API)
  - Issues `coda_session_token` (JWT) and `coda_bridge_token`
- **Parent login**: Separate `coda_parent_session` token
- **Force password change**: `must_change_password` flag on `app_users`

### localStorage Keys

| Key | Purpose | Cleared On |
|-----|---------|------------|
| `coda_session_token` | Student/admin JWT | logout, password change |
| `coda_session_user` | Cached user info | logout |
| `coda_bridge_token` | Base44 bridge auth for submissions | logout |
| `coda_parent_session` | Parent auth | parent logout |

### ⚠️ Known Issue

- `coda_bridge_token` is not cleared on password change — should be added to the logout/force-change flow.

## Data Sources

See [DATA_SOURCES.md](./DATA_SOURCES.md) for the detailed source-of-truth mapping.

### Summary

| Data Type | Source of Truth | Legacy/Backup |
|-----------|----------------|---------------|
| Students | Supabase `students` | Base44 `Student` (diagnostic) |
| App Users | Supabase `app_users` | Base44 `AppUser` (migration) |
| Subjects | Supabase `subjects` | Base44 `Subject` (fallback) |
| Enrollments | Supabase `enrollments` | Base44 `Enrollment` (fallback) |
| Units (Python/C++/HTML/Java/Algorithm) | Supabase `units` | Base44 Entities (legacy fallback) |
| Student Progress | Supabase `student_progress` | Base44 Progress Entities (legacy) |
| Student Submissions | Supabase `student_submissions` | Base44 Submission Entities (bridge fallback) |
| Class Schedules | Base44 `ClassSchedule` | — |
| ClassScheduleStudent | Base44 `ClassScheduleStudent` | — |
| Lesson Feedback | Base44 `LessonFeedback` | — |
| Google Calendar Settings | Base44 `GoogleCalendarSetting` | — |
| Algorithm Judge Submissions | Base44 `AlgorithmJudgeSubmission` + Supabase `student_submissions` | Dual storage |

## Code Execution

### ⚠️ LLM Simulation (Not Real Compiler)

Both `runPythonCode` and `runCppCode` use **LLM simulation**, not real interpreters/compilers.

- **Suitable for**: Simple learning examples, basic syntax practice
- **NOT suitable for**: Accurate auto-grading, complex loops, floating-point, edge cases, infinite loops, time complexity

### Execution Paths

| Path | Purpose | Accuracy |
|------|---------|----------|
| `runPythonCode` (simple) | Learning example execution | LLM simulation |
| `runPythonCode` (judge) | Mission grading | LLM simulation |
| `runCppCode` (simple) | C++ learning execution | LLM simulation |
| `runCppCode` (judge) | C++ mission grading | LLM simulation |
| `judgeAlgorithmProblem` | Algorithm problem judge | LLM simulation (server-side) |

### Unified input() Behavior

All Python execution paths use real Python 3 behavior:
- `input("prompt")` writes the prompt to stdout, then reads a line from stdin
- `input()` (no prompt) writes nothing to stdout
- The typed value is NOT echoed to stdout (non-interactive mode)

## Base44 SDK

All backend functions use `@base44/sdk@0.8.44` (unified, matches `package.json`).

## Backend Functions

### Core Data
- `appLogin` — Custom Supabase authentication
- `adminCreateStudent` — Atomic student creation (Supabase RPC)
- `manageAppUser` — AppUser CRUD
- `changeMyPassword` — Password change
- `supabaseAuthRpc` / `supabaseDataRpc` — Supabase REST proxy

### Learning Data
- `loadUnitsAdmin` — Admin unit loading (Supabase + Base44 fallback)
- `loadStudentAlgorithmUnits` — Student algorithm units
- `generateUnitWithAI` — AI unit generation
- `generatePythonMissionTests` — Mission test generation
- `judgeAlgorithmProblem` — Algorithm problem judging
- `runPythonCode` / `runCppCode` — Code execution (LLM simulation)
- `saveStudentSubmissionBridge` — Bridge fallback for submissions

### Calendar
- `syncGoogleCalendar` — Google Calendar sync (modes: sync, forceSync, preview, diagnose, fullReset, siteOnlyReset, googleOnlyReset)
- `googleCalendars` — List Google Calendars
- `googleCalendarStatus` — Connection status

### Migration & Diagnostics
- `migrateUsersToSupabase` — User migration
- `migrateLearningData` — Learning data migration
- `diagnoseBase44Data` — Data diagnostics
- `diagnoseStudentLinks` — Student link diagnostics
- `getMigrationStatus` — Migration status
- `deleteUnitsBySubject` — Bulk unit deletion

## Google Calendar Sync

### Modes

| Mode | Scope | Site Schedules | Google Schedules | Re-fetch |
|------|-------|---------------|-----------------|----------|
| `sync` | Range only | Preserved | Updated/cancelled | No |
| `forceSync` | Range only | Preserved | Force updated | No |
| `fullReset` | All | **Deleted** | Deleted | Yes |
| `siteOnlyReset` | All | **Deleted** | **Deleted** | No |
| `googleOnlyReset` | Google only | **Preserved** | Deleted | Yes |
| `preview` | Range only | No changes | No changes | No |
| `diagnose` | — | No changes | No changes | No |

### Permissions

- `admin` and `super_admin` can sync (unified)
- Uses `asServiceRole` for entity operations (bypasses RLS)

## Known Technical Debt

1. **Unit source mixing**: `loadAllUnitsWithSource` has 3-tier fallback (backend → Base44 browser → Supabase REST). Migrated subjects should use Supabase only.
2. **Submission dual storage**: Submissions saved to both Supabase and Base44 (bridge fallback). Should consolidate to Supabase only.
3. **Progress entity overlap**: `CppUnitProgress`, `HTMLUnitProgress`, `StudentUnitProgress` (Base44) overlap with `student_progress` (Supabase).
4. **SQL files scattered**: Multiple SQL files in root and `src/` — should be organized into `supabase/migrations/`.
5. **Code execution**: LLM simulation is not reliable for grading — needs real sandboxed runtime for production judge.
6. **Empty catch blocks**: 35 empty catch blocks across codebase — should add comments or proper handling.