
-- Remove the overly permissive anon policies
DROP POLICY IF EXISTS "Anon can read own notifications" ON public.portal_client_notifications;
DROP POLICY IF EXISTS "Anon can update notifications" ON public.portal_client_notifications;

-- Staff can still view all notifications
CREATE POLICY "Staff can view client notifications"
ON public.portal_client_notifications
FOR SELECT
TO authenticated
USING (true);

-- Staff can update notifications
CREATE POLICY "Staff can update client notifications"
ON public.portal_client_notifications
FOR UPDATE
TO authenticated
USING (true);
