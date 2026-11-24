ALTER TABLE orders ADD COLUMN processing_admin_id text REFERENCES users(id);
ALTER TABLE orders ADD COLUMN processing_started_at timestamptz;
ALTER TABLE orders ADD COLUMN completed_at timestamptz;
ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('awaiting_payment','pending_admin','processing','ready','claimed','review','completed','cancelled'));
ALTER TABLE orders ADD CONSTRAINT orders_admin_processing_check CHECK (status <> 'processing' OR (processing_admin_id IS NOT NULL AND processing_started_at IS NOT NULL AND assigned_ctv_id IS NULL));
