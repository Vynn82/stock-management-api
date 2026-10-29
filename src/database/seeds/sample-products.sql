-- StockFlow sample data: products with every property filled in
-- (category, brand, supplier, unit, barcode, SKU, cost/selling price,
-- min/max stock, description, image, variants, stock + location).

BEGIN;
INSERT INTO categories (code, name, description) VALUES
  ('CAT-ELEC', 'Electronics',     'Computers, monitors, printers and storage'),
  ('CAT-ACC',  'Accessories',     'Mice, keyboards, chargers and power banks')
ON CONFLICT DO NOTHING;

INSERT INTO brands (code, name, description) VALUES
  ('BR-LOGI',   'Logitech',  'Computer peripherals'),
  ('BR-DELL',   'Dell',      'Computers and monitors'),
  ('BR-ANKER',  'Anker',     'Chargers and power banks')
ON CONFLICT DO NOTHING;

INSERT INTO suppliers (code, name, contact_person, phone, email, address) VALUES
  ('SUP-GTI',  'Global Tech International',  'Sok Dara',   '+855 12 345 678', 'sales@globaltech.example',  'St. 271, Phnom Penh'),
  ('SUP-ASIA', 'Asia Digital Trading',       'Lim Vuthy',  '+855 96 777 888', 'hello@asiadigital.example', 'Norodom Blvd, Phnom Penh')
ON CONFLICT DO NOTHING;

INSERT INTO warehouses (code, name, description, address, contact_person, phone, capacity) VALUES
  ('WH-MAIN', 'Main Warehouse',      'Central warehouse',  'Russian Blvd, Phnom Penh', 'Heng Rithy', '+855 12 000 111', 5000)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------- products
INSERT INTO products
  (code, name, description, image, category_id, brand_id, supplier_id, has_variants,
   unit, barcode, sku, cost_price, selling_price, minimum_stock, maximum_stock, is_active)
SELECT v.code, v.name, v.description, v.image, c.id, b.id, s.id, v.has_variants,
       v.unit, v.barcode, v.sku, v.cost, v.sell, v.min_stock, v.max_stock, true
FROM (VALUES
  ('P-1001','Logitech M331 Wireless Mouse',   'Silent wireless mouse, 2.4GHz',             'https://picsum.photos/seed/p1001/400/400','CAT-ACC', 'BR-LOGI',  'SUP-GTI',  false,'PCS', '8850001001001','LOG-M331',   8.50, 14.00,  20, 200),
  ('P-1002','Logitech K380 Bluetooth Keyboard','Compact multi-device keyboard',            'https://picsum.photos/seed/p1002/400/400','CAT-ACC', 'BR-LOGI',  'SUP-GTI',  false,'PCS', '8850001002008','LOG-K380',  18.00, 29.00,  15, 150),
  ('P-1003','Dell P2422H 24" Monitor',         'Full HD IPS monitor, HDMI/DP/VGA',         'https://picsum.photos/seed/p1003/400/400','CAT-ELEC','BR-DELL',  'SUP-GTI',  false,'PCS', '8850001003005','DELL-P2422H',135.00,189.00,   8,  60),
  ('P-1007','Anker 20000mAh Power Bank',       'PowerCore 20000, 22.5W fast charging',     'https://picsum.photos/seed/p1007/400/400','CAT-ACC', 'BR-ANKER', 'SUP-ASIA', false,'PCS', '8850001007003','ANK-PC20K',   24.00, 39.00,  15, 120),
  ('P-2001','Dell Inspiron 15 Laptop',         'Everyday laptop, 15.6" Full HD display',   'https://picsum.photos/seed/p2001/400/400','CAT-ELEC','BR-DELL',  'SUP-GTI',  true, 'PCS', '8850002001004','DELL-INS15',  450.00,599.00,   6,  40)
) AS v(code,name,description,image,cat,brand,sup,has_variants,unit,barcode,sku,cost,sell,min_stock,max_stock)
JOIN categories c ON c.code = v.cat
JOIN brands     b ON b.code = v.brand
JOIN suppliers  s ON s.code = v.sup
                  OR s.name = CASE v.sup WHEN 'SUP-GTI' THEN 'Global Tech International'
                                         WHEN 'SUP-ASIA' THEN 'Asia Digital Trading' END
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------- variants
INSERT INTO product_variants
  (product_id, code, name, sku, barcode, attributes, cost_price, selling_price, image, is_active)
SELECT p.id, v.code, v.name, v.sku, v.barcode, v.attrs::jsonb, v.cost, v.sell, v.image, true
FROM (VALUES
  ('P-2001','P-2001-V1','Dell Inspiron 15 - 8GB / 256GB', 'DELL-INS15-8-256', '8850002001101','{"RAM":"8GB","Storage":"256GB"}',  450.00,599.00,'https://picsum.photos/seed/p2001a/400/400'),
  ('P-2001','P-2001-V2','Dell Inspiron 15 - 16GB / 512GB','DELL-INS15-16-512','8850002001102','{"RAM":"16GB","Storage":"512GB"}', 560.00,729.00,'https://picsum.photos/seed/p2001b/400/400')
) AS v(product_code,code,name,sku,barcode,attrs,cost,sell,image)
JOIN products p ON p.code = v.product_code
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------- stock
-- Mix of OK / low / out of stock so the low-stock flow can be tested:
--   ok: P-1003   low: P-1001, P-1007, P-2001   out: P-1002
INSERT INTO stocks (product_id, variant_id, warehouse_id, quantity, location)
SELECT p.id, pv.id, w.id, v.qty, v.location
FROM (VALUES
  ('P-1001', NULL,       'WH-MAIN', 6,   'A-01-01'),
  ('P-1002', NULL,       'WH-MAIN', 0,   'A-01-02'),
  ('P-1003', NULL,       'WH-MAIN', 35,  'A-02-01'),
  ('P-1007', NULL,       'WH-MAIN', 7,   'A-04-01'),
  ('P-2001', 'P-2001-V1','WH-MAIN', 2,   'D-01-01'),
  ('P-2001', 'P-2001-V2','WH-MAIN', 3,   'D-01-02')
) AS v(product_code, variant_code, warehouse_code, qty, location)
JOIN products   p ON p.code = v.product_code
JOIN warehouses w ON w.code = v.warehouse_code
                  OR w.name = CASE v.warehouse_code WHEN 'WH-MAIN' THEN 'Main Warehouse' END
LEFT JOIN product_variants pv ON pv.code = v.variant_code
WHERE NOT EXISTS (
  SELECT 1 FROM stocks s
  WHERE s.product_id = p.id
    AND s.warehouse_id = w.id
    AND s.variant_id IS NOT DISTINCT FROM pv.id
);

COMMIT;
