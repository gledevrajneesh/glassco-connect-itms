import assert from "node:assert/strict";
import { boundedReceiptQuantity, isDedicatedRaiser, procurementActionError, receivedQuantity } from "../src/features/requests/ncrLifecycle.ts";

assert.equal(procurementActionError("Submitted", "start").length > 0, true, "Unapproved requests must not enter procurement");
assert.equal(procurementActionError("Approved", "start"), "");
assert.equal(procurementActionError("Approved", "po").length > 0, true, "PO must not bypass sourcing");
assert.equal(procurementActionError("Procurement review", "quote"), "");
assert.equal(procurementActionError("Procurement review", "po"), "");
assert.equal(procurementActionError("Purchase order", "grn"), "");
assert.equal(procurementActionError("Partially fulfilled", "grn"), "");
assert.equal(procurementActionError("Fulfilled", "grn").length > 0, true, "A fulfilled request must not accept another GRN");

const firstReceipt = [{ lines: [{ itemId: "line-1", quantity: 4 }] }];
assert.equal(receivedQuantity("line-1", firstReceipt), 4);
assert.equal(boundedReceiptQuantity(10, receivedQuantity("line-1", firstReceipt), 3), 3);
assert.equal(boundedReceiptQuantity(10, receivedQuantity("line-1", firstReceipt), 20), 6, "Receipt must be capped at the remaining order quantity");
const completed = [...firstReceipt, { lines: [{ itemId: "line-1", quantity: 6 }] }];
assert.equal(receivedQuantity("line-1", completed), 10, "Partial receipts must aggregate to full receipt");

const activeRaiser = { canRaise: true, status: "Active" };
assert.equal(isDedicatedRaiser("user-1", activeRaiser, [{ status: "Active", raiserUserIds: ["user-1"] }]), true);
assert.equal(isDedicatedRaiser("user-2", activeRaiser, [{ status: "Active", raiserUserIds: ["user-1"] }]), false, "Other group members must not inherit raiser access");
assert.equal(isDedicatedRaiser("user-1", activeRaiser, [{ status: "Active", raiserUserIds: [] }]), false, "An empty raiser list must never mean all users");
assert.equal(isDedicatedRaiser("user-1", { canRaise: false, status: "Active" }, [{ status: "Active", raiserUserIds: ["user-1"] }]), false, "The capability switch must also be enabled");

console.log("PASS  NCR lifecycle: approval gate, sourcing, PO, partial GRN, final receipt and over-receipt protection.");
