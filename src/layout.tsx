import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { useAppColorStore } from "./store/app-color";

export default function Layout({ children }: { children: React.ReactNode }) {
  const background = useAppColorStore((state) => state.color);
  return (
    <div style={{ backgroundColor: background }}>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex flex-1 w-full">
          <SidebarTrigger />
          {children}
        </main>
      </SidebarProvider>
    </div>
  );
}
