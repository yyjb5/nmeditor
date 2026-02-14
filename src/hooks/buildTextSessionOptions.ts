import type useTextSession from "./useTextSession";

type BuildTextSessionOptionsContext = Record<string, any>;

export default function buildTextSessionOptions(
  ctx: BuildTextSessionOptionsContext,
): Parameters<typeof useTextSession>[0] {
  return {
    setError: ctx.setError,
  };
}
