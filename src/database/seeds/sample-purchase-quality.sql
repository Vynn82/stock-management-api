-- StockFlow sample delivery quality: ratings, a partly delivered + closed

BEGIN;

-- Delivery ratings (1-5)
UPDATE goods_receipts gr SET rating = v.rating
FROM (VALUES
  ('GR-PO-SEED-001', 4), ('GR-PO-SEED-002', 4), ('GR-PO-SEED-003', 3),
  ('GR-PO-SEED-004', 5),
  ('GR-PO-SEED-005', 3), ('GR-PO-SEED-006', 2),
  ('GR-PO-SEED-007', 4),
  ('GR-PO-SEED-011', 4), ('GR-PO-SEED-012', 4),
  ('GR-PO-SEED-013', 4), ('GR-PO-SEED-014', 4)
) AS v(receipt_number, rating)
WHERE gr.receipt_number = v.receipt_number;

-- PO-SEED-006 (Asia, Mouse): only 24 of 30 usable, 4 damaged, 2 never came; closed.
UPDATE purchase_order_items poi SET received_quantity = 24
FROM purchase_orders po
WHERE po.id = poi.purchase_order_id AND po.po_number = 'PO-SEED-006'
  AND po.status = 'RECEIVED';

UPDATE goods_receipt_items gri SET quantity = 24
FROM goods_receipts gr
WHERE gr.id = gri.goods_receipt_id AND gr.receipt_number = 'GR-PO-SEED-006'
  AND gri.quantity = 30;

INSERT INTO goods_receipt_issues (goods_receipt_id, purchase_order_item_id, reason, quantity)
SELECT gr.id, poi.id, v.reason, v.qty
FROM goods_receipts gr
JOIN purchase_order_items poi ON poi.purchase_order_id = gr.purchase_order_id
CROSS JOIN (VALUES ('DAMAGED', 4), ('NOT_ARRIVED', 2)) AS v(reason, qty)
WHERE gr.receipt_number = 'GR-PO-SEED-006'
  AND NOT EXISTS (SELECT 1 FROM goods_receipt_issues i WHERE i.goods_receipt_id = gr.id);

UPDATE purchase_orders SET status = 'CLOSED'
WHERE po_number = 'PO-SEED-006' AND status = 'RECEIVED';

COMMIT;
