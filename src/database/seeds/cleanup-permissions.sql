-- Run AFTER `npm run seed`. Makes the DB match the new role/permission matrix.
-- The seed only ADDS rows, so this removes the old ones that no longer apply.

BEGIN;
DELETE FROM permissions WHERE name LIKE 'STAFF\_%';
WITH allowed(role_name, perm_name) AS (
  VALUES
    ('ADMIN','USER_VIEW'),
    ('ADMIN','USER_CREATE'),
    ('ADMIN','USER_ROLE_UPDATE'),
    ('ADMIN','ROLE_VIEW'),
    ('ADMIN','PRODUCT_VIEW'),
    ('ADMIN','PRODUCT_CREATE'),
    ('ADMIN','PRODUCT_UPDATE'),
    ('ADMIN','PRODUCT_DELETE'),
    ('ADMIN','CATEGORY_VIEW'),
    ('ADMIN','CATEGORY_MANAGE'),
    ('ADMIN','BRAND_VIEW'),
    ('ADMIN','BRAND_MANAGE'),
    ('ADMIN','SUPPLIER_VIEW'),
    ('ADMIN','SUPPLIER_MANAGE'),
    ('ADMIN','WAREHOUSE_VIEW'),
    ('ADMIN','WAREHOUSE_MANAGE'),
    ('ADMIN','STOCK_VIEW'),
    ('ADMIN','STOCK_ADJUST'),
    ('ADMIN','ADJUSTMENT_VIEW'),
    ('ADMIN','REQUEST_VIEW'),
    ('ADMIN','REQUEST_CREATE'),
    ('ADMIN','REQUEST_CERTIFY'),
    ('ADMIN','REQUEST_APPROVE'),
    ('ADMIN','REPORT_VIEW'),
    ('ADMIN','REPORT_SEND'),
    ('MANAGER','USER_VIEW'),
    ('MANAGER','USER_CREATE'),
    ('MANAGER','USER_ROLE_UPDATE'),
    ('MANAGER','PRODUCT_VIEW'),
    ('MANAGER','CATEGORY_VIEW'),
    ('MANAGER','BRAND_VIEW'),
    ('MANAGER','SUPPLIER_VIEW'),
    ('MANAGER','WAREHOUSE_VIEW'),
    ('MANAGER','STOCK_VIEW'),
    ('MANAGER','ADJUSTMENT_VIEW'),
    ('MANAGER','REQUEST_VIEW'),
    ('MANAGER','REQUEST_CREATE'),
    ('MANAGER','REQUEST_CERTIFY'),
    ('MANAGER','REPORT_VIEW'),
    ('STAFF','PRODUCT_VIEW'),
    ('STAFF','CATEGORY_VIEW'),
    ('STAFF','BRAND_VIEW'),
    ('STAFF','SUPPLIER_VIEW'),
    ('STAFF','WAREHOUSE_VIEW'),
    ('STAFF','STOCK_VIEW'),
    ('STAFF','REQUEST_VIEW'),
    ('STAFF','REQUEST_CREATE')
)
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name IN ('ADMIN', 'MANAGER', 'STAFF')
  AND NOT EXISTS (
    SELECT 1 FROM allowed a
    WHERE a.role_name = r.name AND a.perm_name = p.name
  );

COMMIT;

-- Check the result:
-- SELECT r.name AS role, count(*) AS permissions
-- FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
-- GROUP BY r.name ORDER BY r.name;
