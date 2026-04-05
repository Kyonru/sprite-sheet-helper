export function isWeb() {
  if ("__TAURI__" in window) {
    return false;
  }

  return true;
}

export function isMac() {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  );
}
