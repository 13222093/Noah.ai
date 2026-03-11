'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/src/context/LanguageContext';

/**
 * Syncs <html lang> attribute with the active i18n language.
 * Fixes WCAG 3.1.2: screen readers use lang to select TTS engine.
 * Renders nothing — pure side-effect component.
 */
export function HtmlLangSync() {
  const { lang } = useLanguage();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return null;
}
