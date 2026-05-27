import { useCallback } from 'react';
import { useLanguage } from './LanguageContext';

export function useTranslation() {
  const { t } = useLanguage();

  const tp = useCallback((key: string, params?: Record<string, string | number>): string => {
    let text = t(key);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  }, [t]);

  const tf = useCallback((key: string, fallback: string): string => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  }, [t]);

  return { t, tf, tp };
}
