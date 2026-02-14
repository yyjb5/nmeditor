import { useState } from "react";

export default function useLocaleState() {
  const [locale, setLocale] = useState<"en" | "zh">(() => {
    const stored = window.localStorage.getItem("nmeditor.locale");
    if (stored === "en" || stored === "zh") return stored;
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  });

  return {
    locale,
    setLocale,
  };
}
