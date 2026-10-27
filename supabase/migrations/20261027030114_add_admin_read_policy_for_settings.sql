-- The public settings policy only exposes instagram, contact, and price.
-- Authenticated admins can read private/internal settings rows used for one-time migration markers.
CREATE POLICY "admins can read settings"
ON public.settings
FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
