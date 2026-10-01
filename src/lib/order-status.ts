export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid – to be sent",
  SHIPPED: "On its way",
  DELIVERED: "Delivered",
  COMPLETED: "Complete",
  DISPUTED: "Problem reported",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const DISPUTE_STATUS_LABEL: Record<string, string> = {
  AWAITING_SELLER: "Waiting for the seller",
  AWAITING_BUYER: "Waiting for the buyer",
  RETURN_REQUESTED: "Return agreed – waiting for postage",
  RETURN_IN_TRANSIT: "Return on its way",
  RETURN_DELIVERED: "Return received",
  ESCALATED: "With our support team",
  RESOLVED_REFUND: "Resolved – refunded",
  RESOLVED_PARTIAL_REFUND: "Resolved – partial refund",
  RESOLVED_RELEASED: "Resolved – payment released",
  CANCELLED: "Closed by buyer",
};
