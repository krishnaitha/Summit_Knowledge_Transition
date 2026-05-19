import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'NexTElevate',
  description: 'Enterprise knowledge transfer portal for team transitions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
