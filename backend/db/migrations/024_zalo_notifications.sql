DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'order_notifications'::regclass
      AND conname = 'order_notifications_channel_check'
  ) THEN
    ALTER TABLE order_notifications DROP CONSTRAINT order_notifications_channel_check;
  END IF;
END $$;

ALTER TABLE order_notifications
  ADD CONSTRAINT order_notifications_channel_check
  CHECK (channel IN ('email','telegram','zalo'));
