export type ProcurementAction = "start" | "quote" | "po" | "grn" | "exception";

const permittedStates: Record<ProcurementAction, readonly string[]> = {
  start: ["Approved"],
  quote: ["Procurement review"],
  po: ["Procurement review"],
  grn: ["Purchase order", "Partially fulfilled"],
  exception: ["Approved", "Procurement review", "Purchase order", "Partially fulfilled"],
};

export function procurementActionError(state: string, action: ProcurementAction) {
  if (permittedStates[action].includes(state)) return "";
  return `Cannot ${action} a request while its status is ${state}. Refresh the record and continue from the current workflow stage.`;
}

export function receivedQuantity(
  itemId: string,
  receipts: readonly { lines: readonly { itemId: string; quantity: number }[] }[] = [],
) {
  return receipts.flatMap((receipt) => receipt.lines)
    .filter((line) => line.itemId === itemId)
    .reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0);
}

export function boundedReceiptQuantity(ordered: number, received: number, submitted: number) {
  return Math.min(Math.max(0, ordered - received), Math.max(0, Number(submitted) || 0));
}

export function isDedicatedRaiser(
  userId: string | undefined,
  capability: { canRaise: boolean; status: string } | undefined,
  mappings: readonly { status: string; raiserUserIds: readonly string[] }[],
) {
  if (!userId || capability?.status !== "Active" || capability.canRaise !== true) return false;
  return mappings.some((mapping) => mapping.status === "Active" && mapping.raiserUserIds.includes(userId));
}
