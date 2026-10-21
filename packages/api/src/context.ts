/** App procedures do not own persistence; demo state lives in the browser. */
export type Context = Record<string, never>;
