-- Removes everything created by sample-purchase-history.sql
-- (purchase orders whose number starts with PO-SEED-, with their lines and receipts).
BEGIN;
DELETE FROM goods_receipts WHERE receipt_number LIKE 'GR-PO-SEED-%';
DELETE FROM purchase_orders WHERE po_number LIKE 'PO-SEED-%';
COMMIT;
