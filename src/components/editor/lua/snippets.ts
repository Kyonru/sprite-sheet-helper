import { snippetCompletion } from "@codemirror/autocomplete";

const LUA_SNIPPETS = [
  snippetCompletion("function ${name}(${params})\n\t${}\nend", {
    label: "function",
    type: "keyword",
    detail: "function definition",
  }),
  snippetCompletion("if ${condition} then\n\t${}\nend", {
    label: "if",
    type: "keyword",
    detail: "if block",
  }),
  snippetCompletion("if ${condition} then\n\t${}\nelse\n\t${}\nend", {
    label: "ifelse",
    type: "keyword",
    detail: "if/else block",
  }),
  snippetCompletion("for ${i} = ${1}, ${n} do\n\t${}\nend", {
    label: "for",
    type: "keyword",
    detail: "numeric for loop",
  }),
  snippetCompletion("for ${k}, ${v} in pairs(${t}) do\n\t${}\nend", {
    label: "forpairs",
    type: "keyword",
    detail: "for pairs loop",
  }),
  snippetCompletion("for ${k}, ${v} in ipairs(${t}) do\n\t${}\nend", {
    label: "foripairs",
    type: "keyword",
    detail: "for ipairs loop",
  }),
  snippetCompletion("while ${condition} do\n\t${}\nend", {
    label: "while",
    type: "keyword",
    detail: "while loop",
  }),
  snippetCompletion("repeat\n\t${}\nuntil ${condition}", {
    label: "repeat",
    type: "keyword",
    detail: "repeat/until loop",
  }),
  snippetCompletion("local ${name} = ${value}", {
    label: "local",
    type: "keyword",
    detail: "local variable",
  }),
  snippetCompletion("local function ${name}(${params})\n\t${}\nend", {
    label: "localfunction",
    type: "keyword",
    detail: "local function",
  }),
  snippetCompletion("pcall(function()\n\t${}\nend)", {
    label: "pcall",
    type: "function",
    detail: "protected call",
  }),
];

export default LUA_SNIPPETS;
