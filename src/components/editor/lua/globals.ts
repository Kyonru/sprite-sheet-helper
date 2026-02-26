import LUA_BUILTINS from "./definitions";
import LUA_SNIPPETS from "./snippets";

const LUA_GLOBALS = [
  // Your custom globals
  { label: "myGlobalFn", type: "function", info: "Does something cool" },
  { label: "myGlobalVar", type: "variable" },
  ...LUA_BUILTINS,
  ...LUA_SNIPPETS,
];

export default LUA_GLOBALS;
