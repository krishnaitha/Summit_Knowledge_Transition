Scaffold a new admin page for this project.

## Context

- Admin pages live under `app/(admin)/admin/`. Each page must call `requireAdmin()` from `lib/auth.ts` at the top.
- Pages are React Server Components by default. Use `'use client'` only for components that need interactivity.
- The admin sidebar navigation is in `components/layout/admin-sidebar.tsx` and `components/layout/admin-mobile-sidebar.tsx` — add a nav link to both.
- Data fetching: call query helpers from `lib/data.ts` directly in the Server Component (no useEffect, no fetch to own API routes). Add new query functions to `lib/data.ts` if needed.
- UI components: use shadcn/ui components (`components/ui/`). Follow the visual pattern of existing admin cards — see `components/admin/stats-card.tsx` or `components/admin/activity-feed.tsx` as examples.
- Never use `any`. All types must be explicit or imported from `lib/types/database.ts`.

## Steps

1. Parse the page name and purpose from `$ARGUMENTS`.
2. Create the directory `app/(admin)/admin/<slug>/` and write `page.tsx`:
   - Call `requireAdmin()` at the top.
   - Fetch data server-side using helpers from `lib/data.ts`.
   - Render with appropriate shadcn/ui layout.
3. If interactive client components are needed, create them under `components/admin/`.
4. Add a nav entry to both `components/layout/admin-sidebar.tsx` and `components/layout/admin-mobile-sidebar.tsx`.
5. If new DB query functions are needed, add them to `lib/data.ts`.
6. Run `npm run typecheck` and `npm run lint` and fix any issues before reporting done.

The page to create: $ARGUMENTS
