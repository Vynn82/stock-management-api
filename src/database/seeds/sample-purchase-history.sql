-- StockFlow sample purchase history, to test the supplier history of
-- low-stock products (run sample-products.sql first).

BEGIN;

INSERT INTO suppliers (code, name, contact_person, phone, email, address) VALUES
  ('SUP-PNH', 'Phnom Penh Office Supply', 'Chan Sreyma', '+855 17 222 333',
   'order@pnhoffice.example', 'St. 63, Phnom Penh')
ON CONFLICT DO NOTHING;

-- One purchase order with its lines and (when [p_lead] is given) one goods
-- receipt [p_lead] days after approval.
-- p_items: [{"p": "<product code>", "qty": n, "price": n, "rec": received qty}]
CREATE FUNCTION pg_temp.seed_po(
  p_no text, p_sup uuid, p_wh uuid, p_user uuid, p_status text,
  p_days_ago int, p_lead numeric, p_items jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  po_id uuid;
  gr_id uuid;
  poi_id uuid;
  created timestamp := now() - make_interval(days => p_days_ago);
  approved timestamp;
  total numeric;
  it jsonb;
  rec numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM purchase_orders WHERE po_number = p_no) THEN
    RETURN;
  END IF;
  IF p_status IN ('APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED') THEN
    approved := created + interval '1 day';
  END IF;
  SELECT sum((i->>'qty')::numeric * (i->>'price')::numeric)
    INTO total FROM jsonb_array_elements(p_items) i;

  INSERT INTO purchase_orders
    (po_number, supplier_id, warehouse_id, status, note, total_amount,
     created_by_id, approved_by_id, approved_at, rejection_reason, created_at, updated_at)
  VALUES
    (p_no, p_sup, p_wh, p_status, 'Seed: purchase history test', total,
     p_user, CASE WHEN approved IS NOT NULL THEN p_user END, approved,
     CASE WHEN p_status = 'REJECTED' THEN 'Price too high (seed)' END, created, created)
  RETURNING id INTO po_id;

  IF p_lead IS NOT NULL THEN
    INSERT INTO goods_receipts (receipt_number, purchase_order_id, received_by_id, note, created_at)
    VALUES ('GR-' || p_no, po_id, p_user, 'Seed receipt',
            approved + make_interval(secs => (p_lead * 86400)::double precision))
    RETURNING id INTO gr_id;
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    rec := CASE WHEN p_status = 'RECEIVED' THEN (it->>'qty')::numeric
                ELSE coalesce((it->>'rec')::numeric, 0) END;
    INSERT INTO purchase_order_items
      (purchase_order_id, product_id, quantity, received_quantity, unit_price, line_total)
    SELECT po_id, p.id, (it->>'qty')::numeric, rec,
           (it->>'price')::numeric, (it->>'qty')::numeric * (it->>'price')::numeric
    FROM products p WHERE p.code = it->>'p'
    RETURNING id INTO poi_id;
    IF gr_id IS NOT NULL AND rec > 0 AND poi_id IS NOT NULL THEN
      INSERT INTO goods_receipt_items (goods_receipt_id, purchase_order_item_id, quantity)
      VALUES (gr_id, poi_id, rec);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  u    uuid := (SELECT id FROM users ORDER BY created_at LIMIT 1);
  wh   uuid := (SELECT id FROM warehouses
                WHERE code = 'WH-MAIN' OR name = 'Main Warehouse'
                ORDER BY (code = 'WH-MAIN') DESC LIMIT 1);
  gti  uuid := (SELECT id FROM suppliers
                WHERE code = 'SUP-GTI' OR name = 'Global Tech International'
                ORDER BY (code = 'SUP-GTI') DESC LIMIT 1);
  asia uuid := (SELECT id FROM suppliers
                WHERE code = 'SUP-ASIA' OR name = 'Asia Digital Trading'
                ORDER BY (code = 'SUP-ASIA') DESC LIMIT 1);
  pnh  uuid := (SELECT id FROM suppliers
                WHERE code = 'SUP-PNH' OR name = 'Phnom Penh Office Supply'
                ORDER BY (code = 'SUP-PNH') DESC LIMIT 1);
BEGIN
  IF u IS NULL OR wh IS NULL OR gti IS NULL OR asia IS NULL OR pnh IS NULL THEN
    RAISE EXCEPTION 'Missing user / warehouse / supplier: run sample-products.sql first';
  END IF;

  -- ---- P-1001 Mouse: three suppliers, tags on PNH and GTI
  PERFORM pg_temp.seed_po('PO-SEED-001', gti,  wh, u, 'RECEIVED', 90, 5, '[{"p":"P-1001","qty":100,"price":8.50}]');
  PERFORM pg_temp.seed_po('PO-SEED-002', gti,  wh, u, 'RECEIVED', 45, 6, '[{"p":"P-1001","qty":50,"price":8.80}]');
  PERFORM pg_temp.seed_po('PO-SEED-003', gti,  wh, u, 'RECEIVED', 10, 7, '[{"p":"P-1001","qty":60,"price":9.20}]');
  PERFORM pg_temp.seed_po('PO-SEED-004', pnh,  wh, u, 'RECEIVED', 20, 2, '[{"p":"P-1001","qty":40,"price":7.90}]');
  PERFORM pg_temp.seed_po('PO-SEED-005', asia, wh, u, 'RECEIVED', 70, 10, '[{"p":"P-1001","qty":30,"price":8.20}]');
  PERFORM pg_temp.seed_po('PO-SEED-006', asia, wh, u, 'RECEIVED', 30, 12, '[{"p":"P-1001","qty":30,"price":8.60}]');

  -- ---- P-1002 Keyboard: only ASIA bought; the other statuses must not count
  PERFORM pg_temp.seed_po('PO-SEED-007', asia, wh, u, 'RECEIVED',  25, 6, '[{"p":"P-1002","qty":40,"price":17.50}]');
  PERFORM pg_temp.seed_po('PO-SEED-008', pnh,  wh, u, 'REJECTED',  15, NULL, '[{"p":"P-1002","qty":40,"price":12.00}]');
  PERFORM pg_temp.seed_po('PO-SEED-009', pnh,  wh, u, 'DRAFT',      5, NULL, '[{"p":"P-1002","qty":40,"price":11.50}]');
  PERFORM pg_temp.seed_po('PO-SEED-010', pnh,  wh, u, 'SUBMITTED',  3, NULL, '[{"p":"P-1002","qty":40,"price":11.00}]');

  -- ---- P-1003 Monitor: GTI and ASIA tie on everything
  PERFORM pg_temp.seed_po('PO-SEED-011', gti,  wh, u, 'RECEIVED',          60, 4, '[{"p":"P-1003","qty":10,"price":140.00}]');
  PERFORM pg_temp.seed_po('PO-SEED-012', gti,  wh, u, 'PARTIALLY_RECEIVED', 18, 4, '[{"p":"P-1003","qty":10,"price":135.00,"rec":4}]');
  PERFORM pg_temp.seed_po('PO-SEED-013', asia, wh, u, 'RECEIVED',          50, 4, '[{"p":"P-1003","qty":10,"price":142.00}]');
  PERFORM pg_temp.seed_po('PO-SEED-014', asia, wh, u, 'RECEIVED',          22, 4, '[{"p":"P-1003","qty":10,"price":135.00}]');

  -- ---- P-1007 Power bank: approved, not delivered yet (still on order)
  PERFORM pg_temp.seed_po('PO-SEED-015', asia, wh, u, 'APPROVED', 2, NULL, '[{"p":"P-1007","qty":100,"price":23.50}]');
  -- ---- P-2001 Laptop: no purchase on purpose
END $$;

COMMIT;
