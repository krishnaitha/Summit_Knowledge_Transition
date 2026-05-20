/**
 * Public environment values — safe to import in 'use client' components.
 * Only contains NEXT_PUBLIC_* variables that are intentionally exposed to the browser.
 * Do NOT add any server-only secrets here.
 */
export const clientEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Summit KT Portal',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  /** Set NEXT_PUBLIC_BOT_NAME to override; defaults to "<appName> AI". */
  botName:
    process.env.NEXT_PUBLIC_BOT_NAME ??
    `${process.env.NEXT_PUBLIC_APP_NAME ?? 'Summit KT Portal'} AI`,
};
