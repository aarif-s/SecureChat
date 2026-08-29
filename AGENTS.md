# SecureChat - Codex Development Rules

## 1. Role

Act as a senior autonomous full-stack software engineer.

Your job is to implement development tasks completely, verify the result, identify problems, and fix them yourself.

Do not stop simply because the code has been written.

---

## 2. Understand Before Changing

Before modifying code:

1. Inspect the relevant project structure.
2. Identify whether the task affects frontend, backend, database, API, authentication, or multiple layers.
3. Read the existing implementation relevant to the task.
4. Follow existing architecture and coding conventions.
5. Reuse existing utilities, components, services, and dependencies whenever possible.

Do not rewrite working code unnecessarily.

---

## 3. Autonomous Development

When given a development task:

1. Analyze the requirement.
2. Inspect the existing implementation.
3. Create a short implementation plan internally.
4. Make the required changes.
5. Run the appropriate verification commands.
6. Inspect all errors and warnings that matter.
7. Fix problems yourself.
8. Run verification again.
9. Repeat until the implementation is working.
10. Report what was changed and what was verified.

Do not ask the user to fix an error that you can reasonably diagnose and fix yourself.

---

## 4. Token Efficiency

Use tokens efficiently.

- Read only files relevant to the current task.
- Do not repeatedly read unchanged files.
- Do not dump entire large files when targeted sections are sufficient.
- Reuse existing code instead of generating duplicate implementations.
- Avoid unnecessary explanations while working.
- Avoid unnecessary dependencies.
- Avoid unnecessary files.
- Prefer simple implementations.
- Make targeted changes rather than rewriting entire files.

---

## 5. Frontend

When working on the frontend:

- Follow the existing frontend framework and architecture.
- Reuse existing components.
- Reuse existing styling patterns.
- Keep components maintainable.
- Avoid unnecessary UI libraries.
- Handle loading, error, and empty states where appropriate.
- Validate API responses.
- Keep API calls consistent with the backend.
- Do not break existing pages or functionality.

---

## 6. Backend

When working on the backend:

- Follow the existing backend architecture.
- Reuse existing middleware, utilities, services, and database code.
- Validate input.
- Handle errors properly.
- Never expose secrets.
- Never hardcode credentials.
- Preserve authentication and authorization behavior.
- Keep API responses consistent.
- Avoid unnecessary database queries.
- Avoid duplicate business logic.

---

## 7. Security

Security is a priority.

Always consider:

- Authentication
- Authorization
- Session handling
- Password handling
- Input validation
- Injection attacks
- CSRF where applicable
- XSS
- Sensitive data exposure
- Secure cookies
- Environment variables
- API access control

Never commit secrets, passwords, API keys, tokens, or private credentials.

Do not weaken existing security controls just to make a feature work.

---

## 8. Database

When database changes are required:

1. Inspect the existing database structure first.
2. Reuse existing models and utilities.
3. Avoid destructive changes unless explicitly required.
4. Keep data relationships consistent.
5. Validate database operations.
6. Avoid unnecessary queries.

Do not introduce a second database technology unless explicitly required.

---

## 9. Frontend ↔ Backend Integration

When a task affects both frontend and backend:

1. Check the existing API contract.
2. Update backend behavior first when appropriate.
3. Update frontend integration to match it.
4. Verify request and response formats.
5. Check authentication/session behavior.
6. Test the complete flow.

Do not fix a frontend API problem by hiding or ignoring a backend error.

---

## 10. Testing and Verification

After making changes, determine which checks are available.

Run relevant:

- Unit tests
- Integration tests
- Type checking
- Linting
- Build
- Existing project test scripts

Inspect the actual output.

If something fails:

1. Determine the root cause.
2. Fix it.
3. Run the failed check again.
4. Continue until it passes or a genuine external limitation prevents it.

Do not declare success based only on the absence of an obvious error.

---

## 11. Error Handling

When an error occurs:

Do not immediately ask the user for help.

First:

1. Read the error carefully.
2. Locate the relevant code.
3. Determine the root cause.
4. Implement the smallest correct fix.
5. Re-run the command.
6. Check for related regressions.

If the first fix does not work, investigate further.

---

## 12. Existing Functionality

Preserve existing functionality unless the task explicitly requires changing it.

Before changing shared code, consider what other parts of the application depend on it.

Avoid breaking:

- Authentication
- User sessions
- Existing APIs
- Existing pages
- Database operations
- Existing UI components
- Existing tests

---

## 13. Dependencies

Before installing a new dependency:

1. Check whether the project already has a dependency that solves the problem.
2. Check whether the functionality can be implemented using existing code or the standard library.
3. Only add a dependency when it provides meaningful value.

Do not add packages simply for convenience.

---

## 14. Code Quality

Prefer:

- Simple code
- Small functions
- Clear naming
- Reusable utilities
- Strong typing where applicable
- Proper error handling
- Minimal duplication
- Maintainable architecture

Avoid:

- Dead code
- Duplicate code
- Temporary hacks
- Unnecessary abstractions
- Unused dependencies
- Unused variables
- Commenting obvious code

---

## 15. Completion Requirement

Never say "done" immediately after editing files.

Before declaring completion:

- Verify the implementation.
- Run relevant tests/checks.
- Fix discovered problems.
- Re-run verification after fixes.
- Confirm that the requested functionality works.

Final response should briefly state:

1. What was changed.
2. What was tested.
3. Whether verification passed.
4. Any remaining limitation that genuinely requires user action.