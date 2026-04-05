
-- =============================================
-- MASS RLS HARDENING: Change {public} → {authenticated} or {service_role}
-- =============================================

-- 1. PORTAL_TOKENS: restrict all to authenticated
DROP POLICY IF EXISTS "Advisors can view all portal tokens" ON portal_tokens;
DROP POLICY IF EXISTS "Advisors can insert portal tokens" ON portal_tokens;
DROP POLICY IF EXISTS "Advisors can update portal tokens" ON portal_tokens;
DROP POLICY IF EXISTS "Advisors can delete portal tokens" ON portal_tokens;

CREATE POLICY "Staff can view portal tokens" ON portal_tokens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert portal tokens" ON portal_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Staff can update portal tokens" ON portal_tokens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete portal tokens" ON portal_tokens FOR DELETE TO authenticated USING (true);

-- 2. PORTAL_REQUESTS: restrict to authenticated + service_role INSERT
DROP POLICY IF EXISTS "Advisors can view all portal requests" ON portal_requests;
DROP POLICY IF EXISTS "Service role can insert portal requests" ON portal_requests;
DROP POLICY IF EXISTS "Advisors can update portal requests" ON portal_requests;
DROP POLICY IF EXISTS "Advisors can delete portal requests" ON portal_requests;

CREATE POLICY "Staff can view portal requests" ON portal_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can insert portal requests" ON portal_requests FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Staff can update portal requests" ON portal_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete portal requests" ON portal_requests FOR DELETE TO authenticated USING (true);

-- 3. PORTAL_REQUEST_MESSAGES: restrict to authenticated + service_role INSERT
DROP POLICY IF EXISTS "Advisors can view all request messages" ON portal_request_messages;
DROP POLICY IF EXISTS "Advisors can insert request messages" ON portal_request_messages;
DROP POLICY IF EXISTS "Advisors can delete request messages" ON portal_request_messages;

CREATE POLICY "Staff can view request messages" ON portal_request_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can insert request messages" ON portal_request_messages FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Staff can delete request messages" ON portal_request_messages FOR DELETE TO authenticated USING (true);

-- 4. FAMILIES: restrict all to authenticated
DROP POLICY IF EXISTS "Advisors can view all families" ON families;
DROP POLICY IF EXISTS "Advisors can insert families" ON families;
DROP POLICY IF EXISTS "Advisors can update families" ON families;
DROP POLICY IF EXISTS "Advisors can delete families" ON families;

CREATE POLICY "Staff can view families" ON families FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert families" ON families FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Staff can update families" ON families FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete families" ON families FOR DELETE TO authenticated USING (true);

-- 5. HOUSEHOLDS: restrict all to authenticated
DROP POLICY IF EXISTS "Advisors can view all households" ON households;
DROP POLICY IF EXISTS "Advisors can insert households" ON households;
DROP POLICY IF EXISTS "Advisors can update households" ON households;
DROP POLICY IF EXISTS "Advisors can delete households" ON households;

CREATE POLICY "Staff can view households" ON households FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert households" ON households FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update households" ON households FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete households" ON households FOR DELETE TO authenticated USING (true);

-- 6. CORPORATIONS: restrict all to authenticated
DROP POLICY IF EXISTS "Advisors can view corporations" ON corporations;
DROP POLICY IF EXISTS "Advisors can insert corporations" ON corporations;
DROP POLICY IF EXISTS "Advisors can update corporations" ON corporations;
DROP POLICY IF EXISTS "Advisors can delete corporations" ON corporations;

CREATE POLICY "Staff can view corporations" ON corporations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert corporations" ON corporations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Staff can update corporations" ON corporations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete corporations" ON corporations FOR DELETE TO authenticated USING (true);

-- 7. SHAREHOLDERS: restrict all to authenticated
DROP POLICY IF EXISTS "Advisors can view shareholders" ON shareholders;
DROP POLICY IF EXISTS "Advisors can insert shareholders" ON shareholders;
DROP POLICY IF EXISTS "Advisors can update shareholders" ON shareholders;
DROP POLICY IF EXISTS "Advisors can delete shareholders" ON shareholders;

CREATE POLICY "Staff can view shareholders" ON shareholders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert shareholders" ON shareholders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update shareholders" ON shareholders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete shareholders" ON shareholders FOR DELETE TO authenticated USING (true);

-- 8. CORPORATE_SHAREHOLDERS: restrict all to authenticated
DROP POLICY IF EXISTS "Advisors can view corporate shareholders" ON corporate_shareholders;
DROP POLICY IF EXISTS "Advisors can insert corporate shareholders" ON corporate_shareholders;
DROP POLICY IF EXISTS "Advisors can update corporate shareholders" ON corporate_shareholders;
DROP POLICY IF EXISTS "Advisors can delete corporate shareholders" ON corporate_shareholders;

CREATE POLICY "Staff can view corporate shareholders" ON corporate_shareholders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert corporate shareholders" ON corporate_shareholders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update corporate shareholders" ON corporate_shareholders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete corporate shareholders" ON corporate_shareholders FOR DELETE TO authenticated USING (true);

-- 9. CORPORATE_VINEYARD_ACCOUNTS: restrict all to authenticated
DROP POLICY IF EXISTS "Advisors can view corporate vineyard" ON corporate_vineyard_accounts;
DROP POLICY IF EXISTS "Advisors can insert corporate vineyard" ON corporate_vineyard_accounts;
DROP POLICY IF EXISTS "Advisors can update corporate vineyard" ON corporate_vineyard_accounts;
DROP POLICY IF EXISTS "Advisors can delete corporate vineyard" ON corporate_vineyard_accounts;

CREATE POLICY "Staff can view corporate vineyard accounts" ON corporate_vineyard_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert corporate vineyard accounts" ON corporate_vineyard_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update corporate vineyard accounts" ON corporate_vineyard_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete corporate vineyard accounts" ON corporate_vineyard_accounts FOR DELETE TO authenticated USING (true);

-- 10. FAMILY_RELATIONSHIPS: restrict all to authenticated
DROP POLICY IF EXISTS "Advisors can view all family relationships" ON family_relationships;
DROP POLICY IF EXISTS "Advisors can insert family relationships" ON family_relationships;
DROP POLICY IF EXISTS "Advisors can update family relationships" ON family_relationships;
DROP POLICY IF EXISTS "Advisors can delete family relationships" ON family_relationships;

CREATE POLICY "Staff can view family relationships" ON family_relationships FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert family relationships" ON family_relationships FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update family relationships" ON family_relationships FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete family relationships" ON family_relationships FOR DELETE TO authenticated USING (true);

-- 11. HOUSEHOLD_RELATIONSHIPS: restrict all to authenticated
DROP POLICY IF EXISTS "Advisors can view all household relationships" ON household_relationships;
DROP POLICY IF EXISTS "Advisors can insert household relationships" ON household_relationships;
DROP POLICY IF EXISTS "Advisors can update household relationships" ON household_relationships;
DROP POLICY IF EXISTS "Advisors can delete household relationships" ON household_relationships;

CREATE POLICY "Staff can view household relationships" ON household_relationships FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert household relationships" ON household_relationships FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update household relationships" ON household_relationships FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete household relationships" ON household_relationships FOR DELETE TO authenticated USING (true);

-- 12. REVIEW_QUEUE: restrict all to authenticated
DROP POLICY IF EXISTS "Advisors can view review queue" ON review_queue;
DROP POLICY IF EXISTS "Advisors can insert review queue" ON review_queue;
DROP POLICY IF EXISTS "Advisors can update review queue" ON review_queue;
DROP POLICY IF EXISTS "Advisors can delete review queue" ON review_queue;

CREATE POLICY "Staff can view review queue" ON review_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can insert review queue" ON review_queue FOR INSERT TO authenticated, service_role WITH CHECK (true);
CREATE POLICY "Staff can update review queue" ON review_queue FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete review queue" ON review_queue FOR DELETE TO authenticated USING (true);

-- 13. MARKETING_UPDATES: restrict to authenticated + service_role
DROP POLICY IF EXISTS "Advisors can view marketing updates" ON marketing_updates;
DROP POLICY IF EXISTS "Anyone can view marketing updates" ON marketing_updates;
DROP POLICY IF EXISTS "Advisors can insert marketing updates" ON marketing_updates;
DROP POLICY IF EXISTS "Allow update marketing_updates" ON marketing_updates;
DROP POLICY IF EXISTS "Advisors can delete marketing updates" ON marketing_updates;

CREATE POLICY "Staff can view marketing updates" ON marketing_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert marketing updates" ON marketing_updates FOR INSERT TO authenticated WITH CHECK (auth.uid() = published_by);
CREATE POLICY "Staff can update marketing updates" ON marketing_updates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete marketing updates" ON marketing_updates FOR DELETE TO authenticated USING (true);
-- Service role needs SELECT for edge functions that process updates
CREATE POLICY "Service can view marketing updates" ON marketing_updates FOR SELECT TO service_role USING (true);

-- 14. MARKETING_UPDATE_READS: restrict to authenticated + service_role
DROP POLICY IF EXISTS "Anyone can read marketing_update_reads" ON marketing_update_reads;
DROP POLICY IF EXISTS "Anyone can insert marketing_update_reads" ON marketing_update_reads;

CREATE POLICY "Staff can view marketing update reads" ON marketing_update_reads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can insert marketing update reads" ON marketing_update_reads FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service can view marketing update reads" ON marketing_update_reads FOR SELECT TO service_role USING (true);

-- 15. PORTAL_TASK_INTERACTIONS: restrict to authenticated + service_role
DROP POLICY IF EXISTS "Allow anon insert for portal interactions" ON portal_task_interactions;
DROP POLICY IF EXISTS "Allow anon select for portal interactions" ON portal_task_interactions;

CREATE POLICY "Staff can view task interactions" ON portal_task_interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can insert task interactions" ON portal_task_interactions FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service can view task interactions" ON portal_task_interactions FOR SELECT TO service_role USING (true);

-- 16. TASK_COLLABORATORS: restrict to authenticated + service_role
DROP POLICY IF EXISTS "Advisors can insert task collaborators" ON task_collaborators;
DROP POLICY IF EXISTS "Advisors can delete task collaborators" ON task_collaborators;
DROP POLICY IF EXISTS "Advisors can view task collaborators" ON task_collaborators;

CREATE POLICY "Staff can view task collaborators" ON task_collaborators FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert task collaborators" ON task_collaborators FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can delete task collaborators" ON task_collaborators FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service can manage task collaborators" ON task_collaborators FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 17. SOVEREIGNTY_AUDIT_TRAIL: restrict to authenticated
DROP POLICY IF EXISTS "Users can create audit entries" ON sovereignty_audit_trail;
DROP POLICY IF EXISTS "Users can view audit trail" ON sovereignty_audit_trail;

CREATE POLICY "Staff can create audit entries" ON sovereignty_audit_trail FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can view audit trail" ON sovereignty_audit_trail FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 18. SECURITY_AUDIT_LOGS: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Service can insert audit logs" ON security_audit_logs;

CREATE POLICY "Service can insert audit logs" ON security_audit_logs FOR INSERT TO service_role WITH CHECK (true);

-- 19. STAFF_NOTIFICATIONS: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Service can insert notifications" ON staff_notifications;

CREATE POLICY "Service can insert staff notifications" ON staff_notifications FOR INSERT TO service_role WITH CHECK (true);

-- 20. PORTAL_CLIENT_NOTIFICATIONS: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Service can insert notifications" ON portal_client_notifications;

CREATE POLICY "Service can insert client notifications" ON portal_client_notifications FOR INSERT TO service_role WITH CHECK (true);

-- 21. DRIVE_WATCH_STATE: restrict INSERT/UPDATE to service_role
DROP POLICY IF EXISTS "Service can insert drive watch state" ON drive_watch_state;
DROP POLICY IF EXISTS "Service can update drive watch state" ON drive_watch_state;

CREATE POLICY "Service can insert drive watch state" ON drive_watch_state FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service can update drive watch state" ON drive_watch_state FOR UPDATE TO service_role USING (true);

-- 22. PORTAL_LOGINS: restrict INSERT to service_role
DROP POLICY IF EXISTS "Service can insert portal logins" ON portal_logins;

CREATE POLICY "Service can insert portal logins" ON portal_logins FOR INSERT TO service_role WITH CHECK (true);

-- 23. STOREHOUSE_RULES: restrict to authenticated
DROP POLICY IF EXISTS "Advisors can view storehouse rules" ON storehouse_rules;
DROP POLICY IF EXISTS "Advisors can insert storehouse rules" ON storehouse_rules;
DROP POLICY IF EXISTS "Advisors can update storehouse rules" ON storehouse_rules;
DROP POLICY IF EXISTS "Advisors can delete storehouse rules" ON storehouse_rules;

CREATE POLICY "Staff can view storehouse rules" ON storehouse_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert storehouse rules" ON storehouse_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update storehouse rules" ON storehouse_rules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete storehouse rules" ON storehouse_rules FOR DELETE TO authenticated USING (true);

-- 24. WATERFALL_PRIORITIES: need to check current policies first
DROP POLICY IF EXISTS "Advisors can view waterfall priorities" ON waterfall_priorities;
DROP POLICY IF EXISTS "Advisors can insert waterfall priorities" ON waterfall_priorities;
DROP POLICY IF EXISTS "Advisors can update waterfall priorities" ON waterfall_priorities;
DROP POLICY IF EXISTS "Advisors can delete waterfall priorities" ON waterfall_priorities;

CREATE POLICY "Staff can view waterfall priorities" ON waterfall_priorities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert waterfall priorities" ON waterfall_priorities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update waterfall priorities" ON waterfall_priorities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete waterfall priorities" ON waterfall_priorities FOR DELETE TO authenticated USING (true);
