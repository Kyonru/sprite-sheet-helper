import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { useAppColorStore } from "./store/app-color";

export default function Layout({ children }: { children: React.ReactNode }) {
  const background = useAppColorStore((state) => state.color);
  return (
    <div className="w-full" style={{ background: background }}>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="relative">
            <SidebarTrigger className="absolute top-0 left-0" />
          </div>
          <div className="h-full min-w-0">{children}</div>
        </main>
      </SidebarProvider>
    </div>
  );
}
