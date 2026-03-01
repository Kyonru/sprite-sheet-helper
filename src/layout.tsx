import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { useAppColorStore } from "./store/app-color";
import useReloadPrompt from "./components/reload-prompt/prompt.web";
import TopPanel from "./components/panels/top";

export default function Layout({ children }: { children: React.ReactNode }) {
  const background = useAppColorStore((state) => state.color);

  useReloadPrompt();
  return (
    <div className="flex w-full" style={{ background: background }}>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <div className="flex flex-1 flex-col h-full w-full">
          <TopPanel />
          <div className="h-full min-w-0">{children}</div>
        </div>
      </SidebarProvider>
    </div>
  );
}
