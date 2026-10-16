# JEJU CODA — Data Sources

이 문서는 각 데이터 종류별 source of truth를 명확히 정의합니다.
Supabase와 Base44가 혼용되는 부분의 충돌을 방지하기 위한 가이드입니다.

## Source of Truth 매핑

### 1. Students (학생)

| 항목 | 값 |
|------|-----|
| **Source of Truth** | Supabase `students` 테이블 |
| **접근 방식** | `dataAccess.js` → Supabase REST (세션 토큰 기반 RLS) |
| **관리자 생성** | `adminCreateStudent` backend function (SECURITY DEFINER RPC) |
| **Base44 Entity** | `Student` — 진단/마이그레이션 용도만 |
| **충돌 위험** | Base44 `Student`에 남은 데이터가 관리자 화면에 노출될 수 있음 |

### 2. App Users (로그인 계정)

| 항목 | 값 |
|------|-----|
| **Source of Truth** | Supabase `app_users` 테이블 |
| **인증** | `appLogin` backend function (PBKDF2-SHA256) |
| **Base44 Entity** | `AppUser` — 마이그레이션 용도만 |
| **충돌 위험** | Base44 `AppUser`와 Supabase `app_users` 간 동기화 누락 가능 |

### 3. Subjects (과목)

| 항목 | 값 |
|------|-----|
| **Source of Truth** | Supabase `subjects` 테이블 |
| **접근 방식** | `dataAccess.js` → `loadActiveSubjects` / `loadAllSubjectsAdmin` |
| **Base44 Entity** | `Subject` — fallback (Supabase 실패 시) |
| **자동 생성** | `SubjectManagement`의 `DEFAULT_SUBJECTS` bootstrap — 누락 시에만 생성 |

### 4. Enrollments (수강)

| 항목 | 값 |
|------|-----|
| **Source of Truth** | Supabase `enrollments` 테이블 |
| **접근 방식** | `dataAccess.js` → Supabase REST |
| **Base44 Entity** | `Enrollment` — fallback |
| **충돌 위험** | 양쪽에 동일 데이터가 있을 수 있음 — Supabase 우선 |

### 5. Units (학습 단원)

| 과목 | Source of Truth | Base44 Entity | 상태 |
|------|----------------|---------------|------|
| Python | Supabase `units` | `PythonUnit` | 마이그레이션 진행 중 |
| Junior Python | Supabase `units` | `JuniorPythonUnit` | 마이그레이션 진행 중 |
| C++ | Supabase `units` | `CppUnit` | 마이그레이션 진행 중 |
| HTML | Supabase `units` | `HTMLUnit` | 마이그레이션 진행 중 |
| Java | Supabase `units` | `JavaUnit` | 마이그레이션 진행 중 |
| Algorithm Learning | Supabase `units` | `AlgorithmUnit` | 마이그레이션 진행 중 |
| Algorithm (Judge) | Base44 `AlgorithmUnit` | — | Base44 only |
| COS | Base44 `COSUnit` / `COSProblem` | — | Base44 only |
| Entry | Base44 `EntryUnit` | — | Base44 only |
| Block | Base44 `BlockProject` | — | Base44 only |

**⚠️ 주의**: `loadAllUnitsWithSource()`는 3-tier fallback 구조:
1. `loadUnitsAdmin` backend (Supabase → Base44 asServiceRole)
2. Base44 Entity 브라우저 직접 조회
3. Supabase REST 직접 조회

마이그레이션 완료 과목은 Supabase만 사용하도록 단순화 필요.

### 6. Student Progress (학습 진행도)

| 항목 | 값 |
|------|-----|
| **Source of Truth** | Supabase `student_progress` 테이블 |
| **접근 방식** | `dataAccess.js` → `save_student_submission` RPC (progress_update 포함) |
| **Base44 Entities** | `CppUnitProgress`, `HTMLUnitProgress`, `StudentUnitProgress` — 레거시 |
| **충돌 위험** | Base44 Progress Entity가 남아 있어 중복 저장 가능성 |
| **권장** | 레거시 Progress Entity는 읽기 전용으로 전환 또는 폐기 |

### 7. Student Submissions (제출 기록)

| 항목 | 값 |
|------|-----|
| **Source of Truth** | Supabase `student_submissions` 테이블 |
| **접근 방식** | `save_student_submission` RPC (세션 토큰 기반) |
| **Bridge Fallback** | `saveStudentSubmissionBridge` backend function (Base44) |
| **Base44 Entities** | `StudentSubmission`, `UnitMissionSubmission`, `UnitQuestionResult`, `CppMissionSubmission`, `HTMLMissionSubmission`, `EntrySubmission`, `COSSubmission` |
| **충돌 위험** | RPC 실패 시 Bridge에 저장 → 두 source에 중복 가능 |
| **권장** | Supabase를 최종 source로 통일, Bridge는 임시 queue로만 사용 |

### 8. Algorithm Judge Submissions

| 항목 | 값 |
|------|-----|
| **Source of Truth** | Base44 `AlgorithmJudgeSubmission` + Supabase `student_submissions` (dual) |
| **접근 방식** | `judgeAlgorithmProblem` backend function에서 양쪽 저장 |
| **비고** | Algorithm judge는 Base44 `AlgorithmUnit`을 사용하므로 Base44 저장이 필요 |

### 9. Class Schedules (수업 일정)

| 항목 | 값 |
|------|-----|
| **Source of Truth** | Base44 `ClassSchedule` Entity |
| **접근 방식** | `base44.entities.ClassSchedule` (직접 SDK) |
| **Google 동기화** | `syncGoogleCalendar` backend function |
| **비고** | Supabase를 사용하지 않음 — Base44 only |

### 10. ClassScheduleStudent (출석)

| 항목 | 값 |
|------|-----|
| **Source of Truth** | Base44 `ClassScheduleStudent` Entity |
| **접근 방식** | `base44.entities.ClassScheduleStudent` (직접 SDK) |
| **비고** | Supabase를 사용하지 않음 — Base44 only |

### 11. Lesson Feedback (수업 피드백)

| 항목 | 값 |
|------|-----|
| **Source of Truth** | Base44 `LessonFeedback` Entity |
| **접근 방식** | `base44.entities.LessonFeedback` (직접 SDK) |
| **비고** | Supabase를 사용하지 않음 — Base44 only |

### 12. Google Calendar Settings

| 항목 | 값 |
|------|-----|
| **Source of Truth** | Base44 `GoogleCalendarSetting` Entity |
| **비고** | Base44 only |

### 13. Live Classroom (실시간 수업)

| 항목 | 값 |
|------|-----|
| **Source of Truth** | Base44 Entities (`LiveSession`, `LiveStudentCode`) |
| **비고** | Base44 only |

## Base44를 사용하는 기능 (Supabase 미사용)

- Google Calendar 동기화 (`ClassSchedule`, `ClassScheduleStudent`, `GoogleCalendarSetting`)
- 수업 피드백 (`LessonFeedback`)
- 실시간 수업 (`LiveSession`, `LiveStudentCode`)
- 알고리즘 저지 (`AlgorithmUnit`, `AlgorithmJudgeSubmission`)
- COS 문제 (`COSUnit`, `COSProblem`, `COSSubmission`)
- 엔트리 (`EntryUnit`, `EntrySubmission`)
- 블록 코딩 (`BlockProject`)
- 캘린더 공지 (`CalendarNotice`)
- 학원 휴일 (`AcademyHoliday`)
- 알림 (`Notification`)

## Supabase를 사용하는 기능 (핵심 학습)

- 인증 (`app_users`, `appLogin`)
- 학생 관리 (`students`)
- 과목 관리 (`subjects`)
- 수강 관리 (`enrollments`)
- 학습 Unit (`units` — Python/C++/HTML/Java/Algorithm)
- 학습 진행도 (`student_progress`)
- 제출 기록 (`student_submissions`)

## 레거시 Entity 목록 (Base44 — 마이그레이션 대상)

| Entity | 상태 | 권장 |
|--------|------|------|
| `Student` | 진단용 | Supabase로 이전 완료 후 폐기 |
| `AppUser` | 마이그레이션용 | Supabase로 이전 완료 후 폐기 |
| `Enrollment` | fallback | Supabase로 이전 완료 후 폐기 |
| `PythonUnit` | 레거시 | Supabase `units`로 이전 후 폐기 |
| `JuniorPythonUnit` | 레거시 | Supabase `units`로 이전 후 폐기 |
| `CppUnit` | 레거시 | Supabase `units`로 이전 후 폐기 |
| `HTMLUnit` | 레거시 | Supabase `units`로 이전 후 폐기 |
| `JavaUnit` | 레거시 | Supabase `units`로 이전 후 폐기 |
| `CppUnitProgress` | 레거시 | Supabase `student_progress`로 통합 |
| `HTMLUnitProgress` | 레거시 | Supabase `student_progress`로 통합 |
| `StudentUnitProgress` | 레거시 | Supabase `student_progress`로 통합 |
| `UnitMissionSubmission` | 레거시 | Supabase `student_submissions`로 통합 |
| `UnitQuestionResult` | 레거시 | Supabase `student_submissions`로 통합 |
| `CppMissionSubmission` | 레거시 | Supabase `student_submissions`로 통합 |
| `HTMLMissionSubmission` | 레거시 | Supabase `student_submissions`로 통합 |