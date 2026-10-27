-- Existing RLS policies require app_metadata.role = 'admin' for INSERT and UPDATE.
GRANT INSERT, UPDATE ON TABLE public.settings TO authenticated;
