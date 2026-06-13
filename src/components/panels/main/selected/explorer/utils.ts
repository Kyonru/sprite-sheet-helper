import type { InspectorField } from "@/components/inspector";

const isVector3 = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((entry) => typeof entry === "number");

const isColor = (key: string, value: unknown): value is string =>
  typeof value === "string" &&
  (key.toLowerCase().includes("color") || /^#[0-9a-f]{6}$/i.test(value));

export const buildInspectorFields = <T extends object>(
  uuid: string,
  updateObj: (uuid: string, props: Partial<T>) => void,
  obj: T,
): InspectorField[] => {
  const fields: InspectorField[] = [];

  for (const key in obj) {
    const typedObj = obj as { type?: string };
    if (typedObj.type === "perspective" && key === "zoom") {
      continue;
    }
    if (typedObj.type === "orthographic" && key === "fov") {
      continue;
    }

    if (key === "type") continue;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const value = obj[key];
    const onChange = (newValue: unknown) =>
      updateObj(uuid, { [key]: newValue } as Partial<T>);

    if (typeof value === "number") {
      fields.push({
        kind: "number",
        label: key,
        value,
        onChange,
      });
    } else if (typeof value === "boolean") {
      fields.push({
        kind: "boolean",
        label: key,
        value,
        onChange,
      });
    } else if (isVector3(value)) {
      fields.push({
        kind: "vector3",
        label: key,
        value,
        onChange,
      });
    } else if (isColor(key, value)) {
      fields.push({
        kind: "color",
        label: key,
        value,
        onChange,
      });
    } else if (typeof value === "string") {
      fields.push({
        kind: "text",
        label: key,
        value,
        onChange,
      });
    } else {
      fields.push({
        kind: "readonly",
        label: key,
        value: JSON.stringify(value),
      });
    }
  }

  return fields;
};
