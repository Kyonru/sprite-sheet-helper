export function isWeb() {
  if ("__TAURI__" in window) {
    return false;
  }

  return true;
}
