import type useAutoIndexPolicy from "./useAutoIndexPolicy";

type BuildAutoIndexPolicyOptionsContext = Record<string, any>;

export default function buildAutoIndexPolicyOptions(
  ctx: BuildAutoIndexPolicyOptionsContext,
): Parameters<typeof useAutoIndexPolicy>[0] {
  return {
    autoIndexMode: ctx.autoIndexMode,
    autoIndexThresholdBytes: ctx.autoIndexThresholdBytes,
  };
}
