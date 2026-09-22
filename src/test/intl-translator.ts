import enMessages from "../../messages/en.json";

function lookupMessage(path: string): string {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, enMessages);

  if (typeof value !== "string") {
    throw new Error(`Missing message: ${path}`);
  }

  return value;
}

function interpolate(
  template: string,
  values?: Record<string, string | number>
): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function createTranslator(namespace?: string) {
  return (key: string, values?: Record<string, string | number>): string => {
    const path = namespace ? `${namespace}.${key}` : key;
    return interpolate(lookupMessage(path), values);
  };
}

export { enMessages };
