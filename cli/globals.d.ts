declare global {
  var __CLI_BUILD__: boolean;
  interface Window {
    __SSH_BRIDGE__: import("../src/lib/cli-bridge").SSHBridge;
  }
}

export {};
