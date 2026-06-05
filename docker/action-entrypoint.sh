#!/usr/bin/env bash
set -uo pipefail

get_input() {
  local name="$1"
  local upper
  local value
  upper="$(printf '%s' "$name" | tr '[:lower:]' '[:upper:]')"
  value="$(printenv "INPUT_${upper}" 2>/dev/null || true)"
  if [[ -z "$value" ]]; then
    value="$(printenv "INPUT_${upper//-/_}" 2>/dev/null || true)"
  fi
  printf '%s' "$value"
}

is_truthy() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "true" || "$value" == "1" || "$value" == "yes" || "$value" == "on" ]]
}

append_value() {
  local flag="$1"
  local input_name="$2"
  local value
  value="$(get_input "$input_name")"
  if [[ -n "$value" ]]; then
    cli_args+=("$flag" "$value")
  fi
}

write_output() {
  local name="$1"
  local value="$2"
  if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
    return
  fi
  {
    printf '%s<<__SPRITE_SHEET_HELPER_EOF__\n' "$name"
    printf '%s\n' "$value"
    printf '__SPRITE_SHEET_HELPER_EOF__\n'
  } >> "$GITHUB_OUTPUT"
}

summary_path="$(mktemp -t sprite-sheet-helper-summary.XXXXXX.json)"
cli_args=()

input_path="$(get_input input)"
if [[ -n "$input_path" ]]; then
  cli_args+=("$input_path")
fi

append_value "--config" "config"
append_value "--job" "job"
append_value "--output" "output"
append_value "--format" "format"
append_value "--workflow" "workflow"
append_value "--frames" "frames"
append_value "--fps" "fps"
append_value "--width" "width"
append_value "--height" "height"
append_value "--normalMap" "normal-map"
append_value "--atlasLayout" "atlas-layout"
append_value "--atlasPadding" "atlas-padding"
append_value "--atlasBleed" "atlas-bleed"
append_value "--atlasScale" "atlas-scale"
append_value "--maxAtlasSize" "max-atlas-size"
append_value "--multiPage" "multi-page"

if is_truthy "$(get_input json)"; then
  cli_args+=("--json")
fi

if is_truthy "$(get_input fail-on-warnings)"; then
  cli_args+=("--failOnWarnings")
fi

cli_args+=("--writeSummary" "$summary_path")

extra_args="$(get_input args)"
if [[ -n "$extra_args" ]]; then
  read -r -a parsed_extra_args <<< "$extra_args"
  cli_args+=("${parsed_extra_args[@]}")
fi

sprite-sheet-helper "${cli_args[@]}"
status=$?

if [[ ! -s "$summary_path" ]]; then
  printf '{"status":"error","jobs":[],"files":[],"warnings":["CLI did not write a summary."],"elapsedMs":0}\n' > "$summary_path"
fi

summary_json="$(cat "$summary_path")"
write_output "summary-json" "$summary_json"

export SSH_SUMMARY_PATH="$summary_path"
outputs_json="$(node --input-type=module <<'NODE'
import { readFileSync } from "node:fs";

const summary = JSON.parse(readFileSync(process.env.SSH_SUMMARY_PATH, "utf8"));
const output = {
  status: summary.status ?? "error",
  files: Array.isArray(summary.files) ? summary.files.join("\n") : "",
  warnings: Array.isArray(summary.warnings) ? summary.warnings.join("\n") : "",
  elapsedMs: String(summary.elapsedMs ?? ""),
};

process.stdout.write(JSON.stringify(output));
NODE
)"

action_status="$(node --input-type=module -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.status)" "$outputs_json")"
action_files="$(node --input-type=module -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.files)" "$outputs_json")"
action_warnings="$(node --input-type=module -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.warnings)" "$outputs_json")"
action_elapsed="$(node --input-type=module -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.elapsedMs)" "$outputs_json")"

write_output "status" "$action_status"
write_output "files" "$action_files"
write_output "warnings" "$action_warnings"
write_output "elapsed-ms" "$action_elapsed"

exit "$status"
