# Systematic Software Development Workflow

This document outlines the systematic process for software development within the **POSCursor** ecosystem. This workflow ensures consistency, reliability, and high-quality code across all features and bug fixes.

---

## 1. Phase 1: Discovery & Analysis

### 🎯 Goal: Deeply understand the requirement and the existing system.

- **Requirement Clarification**: Start by clearly defining the problem or feature. If the request is ambiguous, ask clarifying questions.
- **Codebase Exploration**:
  - Use `list_files` and `read_file` to identify relevant models (`src/database/models`), services (`src/services`), and screens (`app/`).
  - Trace data flows using `grep` to find where functions are called and how data is transformed.
- **Impact Assessment**:
  - How does this change affect the **Sync Layer**?
  - Does it impact **Financial Reports** or **KPI calculations**?
  - Are there **PII (Personally Identifiable Information)** security implications?

---

## 2. Phase 2: Planning & Design

### 🎯 Goal: Create a roadmap for implementation.

- **Set a Plan**: Use the `set_plan` tool to outline the numbered steps for the task.
- **Define Success Criteria**: Identify exactly what needs to be verified for the task to be considered "Done."
- **Architectural Alignment**:
  - Ensure the design follows **Domain-Driven Design (DDD)** principles.
  - Adhere to **SOLID** principles (e.g., Single Responsibility for services).
  - Design for **Offline-First** (local database writes first, sync later).

---

## 3. Phase 3: Development & Implementation

### 🎯 Goal: Execute the plan with precision and incremental verification.

- **Iterative Coding**:
  - Implement changes in small, logical chunks.
  - After every file modification, **verify the change** using `read_file` or `run_in_bash_session`.
- **Encryption Standards**: If adding new fields to `Borrower` or other PII-sensitive models, ensure they are handled by the `EncryptionService`.
- **Model Integrity**: Ensure new models are correctly registered in `schema.ts`, the database initializer, and `SyncService.ts`.

---

## 4. Phase 4: Verification & Testing

### 🎯 Goal: Ensure correctness and prevent regressions.

- **Automated Testing**:
  - Run the full test suite: `npm test`.
  - Add new unit tests for any new business logic in `src/services` or `src/utils`.
- **Frontend Verification**:
  - For UI changes, use Playwright to capture screenshots and verify the layout/flow.
  - Inspect the generated images (e.g., `emulator_screenshot.png`) to ensure visual accuracy.
- **Sync Verification**: Manually or programmatically verify that data correctly flows between WatermelonDB and the mock Supabase environment.

---

## 5. Phase 5: Pre-Commit & Submission

### 🎯 Goal: Finalize the work for review.

- **Pre-Commit Checklist**:
  - Call the `pre_commit_instructions` tool and follow the steps.
  - Remove all debug logs, temporary files, and test artifacts.
  - Review the code for readability and adherence to the project's TypeScript standards.
- **Descriptive Submission**:
  - Use a clear branch name.
  - Write a commit message with a short subject (50 chars) and a detailed body explaining the *why* and *how* of the change.

---

*Last Updated: March 20, 2026*
