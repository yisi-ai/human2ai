export function buildSessionCliCommand(
  sessionId: string,
  origin?: string,
): string {
  const target = origin ? new URL(origin).origin : null;
  const connection = `session connect --session ${sessionId}`;
  return target
    ? `human2ai --api-url ${target} --web-url ${target} ${connection}`
    : `human2ai ${connection}`;
}
