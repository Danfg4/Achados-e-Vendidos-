DROP POLICY IF EXISTS "admins can read settings" ON public.settings;
DROP POLICY IF EXISTS "public can read public settings" ON public.settings;

CREATE POLICY "settings_read_scoped"
ON public.settings
FOR SELECT
TO anon, authenticated
USING (
  key = ANY (ARRAY['instagram'::text, 'contact'::text, 'price'::text])
  OR (((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'
);
