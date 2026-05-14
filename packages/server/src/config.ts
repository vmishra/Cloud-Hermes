/** Server configuration, resolved from the environment with sensible defaults. */
export const SERVER_VERSION = '0.0.0';
export const HOST = process.env.HOST ?? '127.0.0.1';
export const PORT = Number(process.env.PORT ?? 4317);
