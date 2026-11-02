'use client';

// Pengaturan (profile) for W1: language and theme only, stored in this browser.
// The old page (34-province region picker, notification channels shown as
// "(Simulasi)") was removed (UI-030). Notification recipients become an
// admin-only setting (UI-047).

import React from 'react';
import { Settings, Sun, Moon, Monitor, Shield } from 'lucide-react';
import { useLanguage } from '@/src/context/LanguageContext';
import { useTheme } from '@/hooks/useTheme';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageShell } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';

const THEMES = [
  { id: 'dark', label: 'Gelap', icon: Moon },
  { id: 'light', label: 'Terang', icon: Sun },
  { id: 'system', label: 'Ikuti sistem', icon: Monitor },
  { id: 'high-contrast', label: 'Kontras tinggi', icon: Shield },
] as const;

const LANGS = [
  { id: 'id', label: 'Bahasa Indonesia' },
  { id: 'en', label: 'English' },
] as const;

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
        active
          ? 'border-cc-cyan bg-cc-cyan/10 text-cc-text'
          : 'border-cc-border text-cc-text-secondary hover:border-cc-cyan/40',
      )}
    >
      {children}
    </button>
  );
}

export default function SettingsPage() {
  const { lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <PageShell title="Pengaturan" subtitle="Bahasa dan tampilan" icon={<Settings className="h-4 w-4" />}>
      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bahasa</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <OptionButton key={l.id} active={lang === l.id} onClick={() => setLang(l.id)}>
                {l.label}
              </OptionButton>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tema</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <OptionButton key={t.id} active={theme === t.id} onClick={() => setTheme(t.id)}>
                <t.icon className="h-4 w-4" aria-hidden />
                {t.label}
              </OptionButton>
            ))}
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 max-w-3xl text-xs text-cc-text-muted">
        Pengaturan ini hanya tersimpan di peramban ini.
      </p>
    </PageShell>
  );
}
