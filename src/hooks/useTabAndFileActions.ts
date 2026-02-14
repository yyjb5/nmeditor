import useFileOpenActions from "./useFileOpenActions";
import useSaveCurrentAction from "./useSaveCurrentAction";
import useTabLifecycle from "./useTabLifecycle";

type SaveCurrentArgs = Parameters<typeof useSaveCurrentAction>[0];
type TabLifecycleArgs = Omit<Parameters<typeof useTabLifecycle>[0], "saveCurrent">;
type FileOpenArgs = Omit<
  Parameters<typeof useFileOpenActions>[0],
  "confirmSaveOrDiscard" | "createTab"
>;

export interface UseTabAndFileActionsOptions {
  saveCurrentArgs: SaveCurrentArgs;
  tabLifecycleArgs: TabLifecycleArgs;
  fileOpenArgs: FileOpenArgs;
}

export default function useTabAndFileActions({
  saveCurrentArgs,
  tabLifecycleArgs,
  fileOpenArgs,
}: UseTabAndFileActionsOptions) {
  const saveCurrent = useSaveCurrentAction(saveCurrentArgs);

  const { createTab, confirmSaveOrDiscard, handleTabClick, handleTabClose } = useTabLifecycle({
    ...tabLifecycleArgs,
    saveCurrent,
  });

  const { openPath, handleOpen } = useFileOpenActions({
    ...fileOpenArgs,
    confirmSaveOrDiscard,
    createTab,
  });

  return {
    saveCurrent,
    handleTabClick,
    handleTabClose,
    openPath,
    handleOpen,
  };
}
