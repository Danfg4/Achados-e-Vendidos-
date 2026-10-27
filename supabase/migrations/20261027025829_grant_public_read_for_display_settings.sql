-- RLS policy "public can read public settings" limits these values to instagram, contact and price.
GRANT SELECT ON TABLE public.settings TO anon, authenticated;
