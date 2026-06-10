import type { Metadata } from 'next';

import { RuntimeErrorCapture } from '@/components/layout/runtime-error-capture';

import './globals.css';

export const metadata: Metadata = {
  title: 'NexTElevate',
  description: 'Enterprise knowledge transfer portal for team transitions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <RuntimeErrorCapture />
        {children}
      </body>
    </html>
  );
}
