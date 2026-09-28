import type { Metadata } from 'next';
import { Fraunces, Karla, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { HouseProvider } from '@/context/HouseContext';

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});

const karla = Karla({
  variable: '--font-karla',
  subsets: ['latin'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Roomie',
  description: 'Gestión de gastos compartidos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${karla.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <HouseProvider>{children}</HouseProvider>
      </body>
    </html>
  );
}