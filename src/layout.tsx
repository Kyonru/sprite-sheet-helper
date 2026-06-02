import useReloadPrompt from "./components/reload-prompt/prompt.web";
import TopPanel from "./components/panels/top";

export default function Layout({ children }: { children: React.ReactNode }) {
  useReloadPrompt();
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col h-full w-full">
        <TopPanel />
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
