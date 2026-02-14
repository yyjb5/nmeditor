import type useCsvSession from "./useCsvSession";

type BuildCsvSessionOptionsContext = Record<string, any>;

export default function buildCsvSessionOptions(
  ctx: BuildCsvSessionOptionsContext,
): Parameters<typeof useCsvSession>[0] {
  return {
    setError: ctx.setError,
  };
}
