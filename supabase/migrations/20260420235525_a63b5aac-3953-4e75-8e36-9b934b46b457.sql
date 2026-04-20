CREATE POLICY "Staff can delete client notifications"
ON public.portal_client_notifications
FOR DELETE
TO authenticated
USING (true);