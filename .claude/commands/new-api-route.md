Scaffold a new Next.js App Router API route for this project.

## Context

- All API routes live under `app/api/`. Auth is checked per-route — there is no middleware.
- Auth helpers are in `lib/auth.ts`: `getCurrentUserContext()` returns `{ userId, role }` or throws a redirect; use `requireAdmin()` for admin-only routes.
- All SQL lives in `lib/data.ts` using the tagged-template client from `lib/db.ts`. Add new query functions there, not inline in the route.
- Return `NextResponse.json(...)` for JSON responses. Return `NextResponse.json({ error: 'message' }, { status: 4xx })` for errors.
- Never use `any` — TypeScript strict mode is enforced. Define explicit types or import from `lib/types/database.ts`.
- Log unexpected errors with `logApplicationError` from `lib/observability.ts`.

## Steps

1. Determine the route path from `$ARGUMENTS`. Create the directory `app/api/<path>/` if needed.
2. Write `app/api/<path>/route.ts` with:
   - Correct HTTP method exports (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`) as needed.
   - Auth check at the top of each handler.
   - Input validation (parse and type-check `request.json()` before using values).
   - Database calls via a new helper in `lib/data.ts` (don't inline raw SQL in the route).
   - Proper error handling with `logApplicationError` for unexpected errors.
3. If any new DB query functions are needed, add them to `lib/data.ts`.
4. Run `npm run typecheck` and `npm run lint` and fix any issues before reporting done.

The route to create: $ARGUMENTS
