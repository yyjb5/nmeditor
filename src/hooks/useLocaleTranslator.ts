import { useCallback } from "react";

export interface UseLocaleTranslatorOptions {
  locale: "en" | "zh";
}

export default function useLocaleTranslator({ locale }: UseLocaleTranslatorOptions) {
  const t = useCallback(
    (en: string, zh: string) => (locale === "zh" ? zh : en),
    [locale],
  );

  return {
    t,
  };
}
