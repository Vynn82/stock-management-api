import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/** A warehouse counts as "nearly full" from this share of its capacity. */
export const NEARLY_FULL_RATIO = 0.9;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export type CapacityLevel = 'unlimited' | 'ok' | 'nearly_full' | 'over';

export interface WarehouseLoad {
  warehouseId: string;
  name: string;
  /** Null = no limit. */
  capacity: number | null;
  /** Units in stock right now (every product, every variant). */
  used: number;
  /** Units still to arrive on other open purchase orders. */
  incoming: number;
}

/**
 * Stock in the warehouse plus what is already on order for it. Open orders
 * are SUBMITTED, APPROVED and PARTIALLY_RECEIVED; [excludePoId] leaves one
 * order out (the one being checked).
 */
export async function loadWarehouse(
  manager: EntityManager,
  warehouseId: string,
  excludePoId?: string | null,
): Promise<WarehouseLoad | null> {
  const rows: Array<{
    id: string;
    name: string;
    capacity: string | null;
    used: string;
    incoming: string;
  }> = await manager.query(
    `SELECT w.id, w.name, w.capacity,
        COALESCE((SELECT SUM(s.quantity) FROM stocks s
                  WHERE s.warehouse_id = w.id), 0) AS used,
        COALESCE((SELECT SUM(GREATEST(i.quantity - i.received_quantity, 0))
                  FROM purchase_order_items i
                  JOIN purchase_orders p ON p.id = i.purchase_order_id
                  WHERE p.warehouse_id = w.id
                    AND p.status IN ('SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED')
                    AND ($2::uuid IS NULL OR p.id <> $2::uuid)), 0) AS incoming
       FROM warehouses w
      WHERE w.id = $1`,
    [warehouseId, excludePoId ?? null],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    warehouseId: row.id,
    name: row.name,
    capacity: row.capacity === null ? null : Number(row.capacity),
    used: Number(row.used),
    incoming: Number(row.incoming),
  };
}

/** Where the warehouse stands if [orderQuantity] more units arrive. */
export function evaluateCapacity(load: WarehouseLoad, orderQuantity: number) {
  const projected = r3(load.used + load.incoming + orderQuantity);
  if (load.capacity === null || load.capacity <= 0) {
    return {
      capacity: null,
      used: load.used,
      incoming: load.incoming,
      orderQuantity,
      projected,
      freeAfter: null as number | null,
      percentAfter: null as number | null,
      level: 'unlimited' as CapacityLevel,
    };
  }
  const ratio = projected / load.capacity;
  const level: CapacityLevel =
    ratio > 1 ? 'over' : ratio >= NEARLY_FULL_RATIO ? 'nearly_full' : 'ok';
  return {
    capacity: load.capacity,
    used: load.used,
    incoming: load.incoming,
    orderQuantity,
    projected,
    freeAfter: r3(load.capacity - projected),
    percentAfter: Math.round(ratio * 1000) / 10,
    level,
  };
}

/** Throws when [orderQuantity] more units would not fit. */
export function assertFits(load: WarehouseLoad, orderQuantity: number) {
  const result = evaluateCapacity(load, orderQuantity);
  if (result.level !== 'over' || load.capacity === null) return;
  const freeNow = Math.max(r3(load.capacity - load.used - load.incoming), 0);
  throw new BadRequestException(
    `Warehouse "${load.name}" does not have enough room: capacity ${load.capacity}, ` +
      `in stock ${load.used}, already on order ${load.incoming}, ` +
      `this order ${orderQuantity}. Only ${freeNow} free.`,
  );
}
