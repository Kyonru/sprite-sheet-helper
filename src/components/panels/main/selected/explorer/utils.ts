import type { Schema } from "leva/plugin";

export const buildInputs = <T extends object>(
  uuid: string,
  updateObj: (uuid: string, props: Partial<T>) => void,
  obj: T,
  schema: Schema,
) => {
  for (const key in obj) {
    if (key === "type") continue;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    schema[key] = {
      value: obj[key],
      onChange: (value: unknown) =>
        updateObj(uuid, { [key]: value } as Partial<T>),
    };
  }
};
