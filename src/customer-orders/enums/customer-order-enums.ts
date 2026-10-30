export enum DeliveryStatus {
  PENDING = 'PENDING',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CASH = 'CASH',
}

export enum MessageSenderType {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  SYSTEM = 'SYSTEM',
}

export enum MessageType {
  TEXT = 'TEXT',
  QUESTION = 'QUESTION',
  RESPONSE = 'RESPONSE',
  STATUS_UPDATE = 'STATUS_UPDATE',
}
