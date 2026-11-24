ALTER TABLE games ADD COLUMN IF NOT EXISTS input_config jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='games'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) LIKE '%jsonb_typeof(input_config)%'
  ) THEN
    ALTER TABLE games ADD CONSTRAINT games_input_config_object CHECK (jsonb_typeof(input_config)='object');
  END IF;
END $$;
