// app/layout.tsx

import './globals.css';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/hooks/useTheme';
import { Toaster } from 'react-hot-toast';
import { AlertCountProvider } from '@/components/contexts/AlertCountContext';
import 'leaflet/dist/leaflet.css';
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import ClientLayoutWrapper from '@/components/layout/ClientLayoutWrapper';
import { LanguageProvider } from '@/src/context/LanguageContext';
import { StatsProvider } from '@/components/contexts/StatsContext';

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

export const metadata = {
  metadataBase: new URL('https://noah.ai.id'),
  title: "noah.ai — AI Flood Command Center",
  description: "AI-powered flood prediction, real-time monitoring, and SMS alerts for vulnerable communities",
  icons: {
    icon: [
      { url: '/web-app-manifest-192x192.png', sizes: '192x192' },
      { url: '/web-app-manifest-512x512.png', sizes: '512x512' },
    ],
    apple: { url: '/apple-icon.png' },
  },
  verification: {
    google: 'od3kGfaYj9zBkKYrLnZFTFlynJDYt9dDxa22ivRHMtQ',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans bg-cc-bg`}>
        <ReactQueryProvider>
          <ThemeProvider>
            <AlertCountProvider>
              <LanguageProvider>
                <StatsProvider>
                  <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
                </StatsProvider>
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
            </AlertCountProvider>
          </ThemeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
