// app/layout.tsx

import './globals.css';
import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/hooks/useTheme';
import { Toaster } from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import ClientLayoutWrapper from '@/components/layout/ClientLayoutWrapper';
import { LanguageProvider } from '@/src/context/LanguageContext';
import { SimulasiBanner } from '@/components/demo/SimulasiBadge';
import { isDemoMode } from '@/lib/demo';

// Command Center fonts
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Noah AI, Pendukung Keputusan Pengendalian Banjir',
  description:
    'Modul pendukung keputusan untuk operator pengendalian banjir DKI Jakarta. Hanya untuk pengguna terdaftar.',
  // The trial is not public (08_ROLES_AND_ACCESS.md): never index.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  icons: {
    icon: [
      { url: '/web-app-manifest-192x192.png', sizes: '192x192' },
      { url: '/web-app-manifest-512x512.png', sizes: '512x512' },
    ],
    apple: { url: '/apple-icon.png' },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans bg-cc-bg`}>
        <ReactQueryProvider>
          <ThemeProvider>
            <LanguageProvider>
              <SimulasiBanner active={isDemoMode()} />
              <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
            </LanguageProvider>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 5000,
                  style: {
                    background: 'var(--cc-surface)',
                    color: 'var(--cc-text)',
                    border: '1px solid var(--cc-border)',
                    borderRadius: '6px',
                    fontSize: '13px',
                  },
                }}
              />
          </ThemeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
