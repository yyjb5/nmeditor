import type useColumnManagement from "./useColumnManagement";

type BuildColumnManagementOptionsContext = Record<string, any>;

export default function buildColumnManagementOptions(
  ctx: BuildColumnManagementOptionsContext,
): Parameters<typeof useColumnManagement>[0] {
  return {
    dataColumnCount: ctx.dataColumnCount,
  };
}
