import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Interest Profile',
  description: 'Doomscrolling → portable preference profile.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
