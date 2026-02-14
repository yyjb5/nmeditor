import CsvWorkspacePage from "./pages/CsvWorkspacePage";
import TextEditorPage from "./pages/TextEditorPage";
import useAppViewModel from "./hooks/useAppViewModel";
import "./App.css";

function App() {
  const { fileMode, textEditorPageProps, csvWorkspacePageProps } = useAppViewModel();

  return (
    <div className="app-shell">
      {fileMode === "text" ? (
        <TextEditorPage {...textEditorPageProps} />
      ) : (
        <CsvWorkspacePage {...csvWorkspacePageProps} />
      )}
    </div>
  );
}

export default App;
