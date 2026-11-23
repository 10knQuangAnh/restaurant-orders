export const KITCHEN_TRANSITIONS: Record<string, readonly string[]> = {
  queued: ["preparing", "done", "86", "cancelled"],
  preparing: ["done", "86", "cancelled"],
  done: ["served"],
  served: [],
  "86": [],
  cancelled: [],
};

export function canTransition(from: string, to: string): boolean {
  return (KITCHEN_TRANSITIONS[from] ?? []).includes(to);
}

export function kitchenOpTarget(op: "start" | "done" | "86" | "served" | "cancel"): string {
  if (op === "start") return "preparing";
  if (op === "done") return "done";
  if (op === "86") return "86";
  if (op === "served") return "served";
  return "cancelled";
}
