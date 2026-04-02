export type Locale = "zh" | "en";
export type MessageValue = string | { [key: string]: MessageValue };
export type MessageSchema = { [key: string]: MessageValue };
type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
export type NestedMessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : (T[K] extends Record<string, unknown> ? Join<K, NestedMessageKey<T[K]>> : never);
}[keyof T & string];
