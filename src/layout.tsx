import useReloadPrompt from "./components/reload-prompt/prompt.web";
import TopPanel from "./components/panels/top";

export default function Layout({ children }: { children: React.ReactNode }) {
  useReloadPrompt();
  return (
    <div className="flex h-screen w-screen">
      <div className="flex flex-1 flex-col h-full w-full">
        <TopPanel />
        <div className="h-full min-w-0">{children}</div>
      </div>
    </div>
  );
}
