import type { JSONPath } from "jsonc-parser";

// Set the value at the provided JSONPath inside jsonString and return
// the resulting JSON string formatted with 2 spaces.
export function setValueAtPath(jsonString: string, path: JSONPath | undefined, value: any) {
  let obj: any;
  try {
    obj = JSON.parse(jsonString || "null");
  } catch (e) {
    // If current JSON is invalid, throw so caller can handle
    throw new Error("Invalid JSON");
  }

  if (!path || path.length === 0) {
    return JSON.stringify(value, null, 2);
  }

  let cursor: any = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (typeof seg === "number") {
      if (!Array.isArray(cursor)) throw new Error("Path does not match JSON structure");
      cursor = cursor[seg];
    } else {
      cursor = cursor?.[seg];
    }
  }

  const last = path[path.length - 1];
  if (typeof last === "number") {
    if (!Array.isArray(cursor)) throw new Error("Path does not match JSON structure");
    cursor[last] = value;
  } else {
    cursor[last] = value;
  }

  return JSON.stringify(obj, null, 2);
}
