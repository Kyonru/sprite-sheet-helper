import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { useAppColorStore } from "./store/app-color";

export default function Layout({ children }: { children: React.ReactNode }) {
  const background = useAppColorStore((state) => state.color);
  return (
    <div
      className="flex h-[90px] w-full"
      style={{ backgroundColor: background }}
    >
      <SidebarProvider>
        <AppSidebar />
        <main>
          <SidebarTrigger />
          {children}
        </main>
      </SidebarProvider>
    </div>
  );
}
