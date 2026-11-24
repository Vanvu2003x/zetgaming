ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN guest_token_hash text;
ALTER TABLE orders ADD CONSTRAINT orders_owner_check CHECK (
  (customer_id IS NOT NULL AND guest_token_hash IS NULL)
  OR (customer_id IS NULL AND guest_token_hash IS NOT NULL AND payment_method='direct')
);
CREATE UNIQUE INDEX orders_guest_idempotency_idx ON orders(guest_token_hash,idempotency_key)
  WHERE guest_token_hash IS NOT NULL;
