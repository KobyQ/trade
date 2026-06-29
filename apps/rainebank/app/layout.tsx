import './globals.css';

export const metadata = {
  title: 'RaineBank',
  description: 'Financial Intelligence'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
