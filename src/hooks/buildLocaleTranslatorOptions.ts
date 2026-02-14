import type useLocaleTranslator from "./useLocaleTranslator";

type BuildLocaleTranslatorOptionsContext = Record<string, any>;

export default function buildLocaleTranslatorOptions(
  ctx: BuildLocaleTranslatorOptionsContext,
): Parameters<typeof useLocaleTranslator>[0] {
  return {
    locale: ctx.locale,
  };
}
