import type { ReactNode } from 'react';

export const metadata = {
  title: 'signals-engine',
  description: 'Auditable AI-assisted trading signal platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Arial, sans-serif', margin: 0, background: '#0f172a', color: '#e2e8f0' }}>
        <header style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>
          <h1 style={{ margin: 0 }}>signals-engine</h1>
        </header>
        <main style={{ padding: '1rem' }}>{children}</main>
      </body>
    </html>
  );
}
