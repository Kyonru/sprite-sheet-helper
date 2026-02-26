import { useEffect } from "react";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function useReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log("SW Registered: " + r);
    },
    onRegisterError(error) {
      console.log("SW registration error", error);
    },
  });
  useEffect(() => {
    if (offlineReady) {
      toast.success("App ready to work offline", {
        description: "You can now use the app without internet.",
        action: {
          label: "Close",
          onClick: () => setOfflineReady(false),
        },
        id: "offline-ready",
      });
    }
  }, [offlineReady, setOfflineReady]);
  useEffect(() => {
    if (needRefresh) {
      toast("New update available", {
        description: "Click reload to update the app.",
        action: {
          label: "Reload",
          onClick: () => updateServiceWorker(true),
        },
        cancel: {
          label: "Dismiss",
          onClick: () => setNeedRefresh(false),
        },
        id: "need-refresh",
      });
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);
  return null;
}
