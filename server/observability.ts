export function logServerError(event: string, error: unknown, context: Record<string, unknown> = {}) {
  const details = error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: String(error) };
  console.error(JSON.stringify({ level: "error", event, ...context, ...details, at: new Date().toISOString() }));
}
