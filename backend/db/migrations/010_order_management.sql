ALTER TABLE orders ADD COLUMN paid_at timestamptz;
ALTER TABLE orders ADD COLUMN cancelled_at timestamptz;
-- Keep payment recording correct while old and new app instances overlap during a rolling release.
CREATE FUNCTION record_order_paid_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.paid_at IS NULL AND (NEW.payment_method='wallet' OR (NEW.payment_method='direct' AND NEW.status IN ('pending_admin','processing','ready','claimed','review','completed'))) THEN
    NEW.paid_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER orders_record_paid_at BEFORE INSERT OR UPDATE OF status,payment_method ON orders FOR EACH ROW EXECUTE FUNCTION record_order_paid_at();
UPDATE orders SET paid_at=created_at WHERE payment_method='wallet' OR status IN ('pending_admin','processing','ready','claimed','review','completed');
UPDATE orders o SET paid_at=e.created_at FROM (SELECT entity_id,min(created_at) created_at FROM audit_events WHERE action='order.payment_confirmed' GROUP BY entity_id) e WHERE o.id=e.entity_id AND o.payment_method='direct';
ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('awaiting_payment','pending_admin','processing','needs_review','failed','refund_pending','refunded','ready','claimed','review','completed','cancelled'));

CREATE TABLE order_notes (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id),
  actor_id text NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_notes_order_idx ON order_notes(order_id,created_at);
CREATE INDEX audit_events_entity_created_idx ON audit_events(entity_id,created_at DESC);
CREATE TABLE order_refunds (
  id text PRIMARY KEY,
  order_id text NOT NULL UNIQUE REFERENCES orders(id),
  amount_cents bigint NOT NULL CHECK (amount_cents>0),
  method text NOT NULL CHECK (method IN ('wallet','direct')),
  state text NOT NULL CHECK (state IN ('pending','paid')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  requested_by text NOT NULL REFERENCES users(id),
  confirmed_by text REFERENCES users(id),
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CHECK ((state='pending' AND paid_at IS NULL AND confirmed_by IS NULL) OR (state='paid' AND paid_at IS NOT NULL AND confirmed_by IS NOT NULL)),
  CHECK (state<>'paid' OR method<>'direct' OR length(reference) BETWEEN 3 AND 120)
);
CREATE UNIQUE INDEX order_refunds_bank_reference_unique ON order_refunds(lower(reference)) WHERE method='direct' AND state='paid';
