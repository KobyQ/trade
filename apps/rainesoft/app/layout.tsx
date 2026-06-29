import './globals.css';

export const metadata = {
  title: 'RaineSoft Solutions',
  description: 'Enterprise Financial Infrastructure',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
