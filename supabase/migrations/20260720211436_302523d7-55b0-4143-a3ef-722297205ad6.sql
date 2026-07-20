
-- 1. REPLICA IDENTITY FULL for full row payloads in realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.invoices REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.ledger_entries REPLICA IDENTITY FULL;
ALTER TABLE public.credit_purse REPLICA IDENTITY FULL;
ALTER TABLE public.employees REPLICA IDENTITY FULL;
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.audit_log REPLICA IDENTITY FULL;
ALTER TABLE public.gst_verification REPLICA IDENTITY FULL;

-- 2. Add to realtime publication (idempotent guarded)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'orders','invoices','tasks','ledger_entries','credit_purse',
    'employees','clients','profiles','audit_log','gst_verification'
  ]) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 3. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tone TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4. Realtime events log
CREATE TABLE IF NOT EXISTS public.realtime_events_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rt_events_created_idx ON public.realtime_events_log(created_at DESC);

GRANT SELECT ON public.realtime_events_log TO authenticated;
GRANT ALL ON public.realtime_events_log TO service_role;

ALTER TABLE public.realtime_events_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read realtime events"
  ON public.realtime_events_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- 5. Add tables to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='realtime_events_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.realtime_events_log;
  END IF;
END $$;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.realtime_events_log REPLICA IDENTITY FULL;

-- 6. Helper: insert notification for all admins
CREATE OR REPLACE FUNCTION private.notify_admins(
  p_tone TEXT, p_title TEXT, p_body TEXT, p_entity_type TEXT, p_entity_id UUID
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  INSERT INTO public.notifications (user_id, tone, title, body, entity_type, entity_id)
  SELECT ur.user_id, p_tone, p_title, p_body, p_entity_type, p_entity_id
  FROM public.user_roles ur WHERE ur.role = 'admin';
END $$;

CREATE OR REPLACE FUNCTION private.notify_user(
  p_user_id UUID, p_tone TEXT, p_title TEXT, p_body TEXT, p_entity_type TEXT, p_entity_id UUID
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, tone, title, body, entity_type, entity_id)
  VALUES (p_user_id, p_tone, p_title, p_body, p_entity_type, p_entity_id);
END $$;

CREATE OR REPLACE FUNCTION private.log_rt_event(
  p_channel TEXT, p_event TEXT, p_payload JSONB
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  INSERT INTO public.realtime_events_log (actor_id, channel, event_type, payload)
  VALUES (auth.uid(), p_channel, p_event, COALESCE(p_payload, '{}'::jsonb));
END $$;

REVOKE EXECUTE ON FUNCTION private.notify_admins(TEXT,TEXT,TEXT,TEXT,UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.notify_user(UUID,TEXT,TEXT,TEXT,TEXT,UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.log_rt_event(TEXT,TEXT,JSONB) FROM PUBLIC;

-- 7. Trigger: orders
CREATE OR REPLACE FUNCTION public.trg_orders_realtime()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_client_profile UUID;
  v_emp_profile UUID;
  v_company TEXT;
BEGIN
  SELECT profile_id, company_name INTO v_client_profile, v_company FROM public.clients WHERE id = NEW.client_id;
  SELECT profile_id INTO v_emp_profile FROM public.employees WHERE id = NEW.employee_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM private.notify_user(v_client_profile, 'info',
      'New order awaiting confirmation',
      COALESCE(NEW.order_no, 'Order') || ' — ' || v_company, 'order', NEW.id);
    PERFORM private.notify_admins(
      CASE WHEN NEW.needs_admin_approval THEN 'warning' ELSE 'info' END,
      CASE WHEN NEW.needs_admin_approval THEN 'Order needs admin approval' ELSE 'New order punched' END,
      COALESCE(NEW.order_no,'Order') || ' — ' || v_company, 'order', NEW.id);
    PERFORM private.log_rt_event('orders', 'created',
      jsonb_build_object('order_id', NEW.id, 'client_id', NEW.client_id, 'value', NEW.value));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.confirmation IS DISTINCT FROM OLD.confirmation THEN
      PERFORM private.notify_user(v_emp_profile,
        CASE NEW.confirmation WHEN 'Accepted' THEN 'success' WHEN 'Declined' THEN 'destructive' ELSE 'warning' END,
        'Client ' || NEW.confirmation || ' order',
        COALESCE(NEW.order_no,'Order') || ' — ' || v_company, 'order', NEW.id);
      PERFORM private.notify_admins('info',
        'Order ' || NEW.confirmation, COALESCE(NEW.order_no,'Order') || ' — ' || v_company, 'order', NEW.id);
      PERFORM private.log_rt_event('orders', 'confirmation_changed',
        jsonb_build_object('order_id', NEW.id, 'from', OLD.confirmation, 'to', NEW.confirmation));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM private.notify_user(v_client_profile, 'info',
        'Order status: ' || NEW.status, COALESCE(NEW.order_no,'Order'), 'order', NEW.id);
      PERFORM private.log_rt_event('orders', 'status_changed',
        jsonb_build_object('order_id', NEW.id, 'from', OLD.status, 'to', NEW.status));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_realtime ON public.orders;
CREATE TRIGGER orders_realtime
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_orders_realtime();

-- 8. Trigger: invoices
CREATE OR REPLACE FUNCTION public.trg_invoices_realtime()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_client_profile UUID; v_company TEXT;
BEGIN
  SELECT profile_id, company_name INTO v_client_profile, v_company FROM public.clients WHERE id = NEW.client_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM private.notify_user(v_client_profile, 'info',
      'New invoice issued', COALESCE(NEW.invoice_no,'Invoice') || ' — ₹' || NEW.amount, 'invoice', NEW.id);
    PERFORM private.log_rt_event('invoices', 'created',
      jsonb_build_object('invoice_id', NEW.id, 'amount', NEW.amount));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.approval IS DISTINCT FROM OLD.approval THEN
      PERFORM private.notify_admins(
        CASE NEW.approval WHEN 'Accepted' THEN 'success' WHEN 'Declined' THEN 'destructive' ELSE 'info' END,
        'Invoice ' || NEW.approval, COALESCE(NEW.invoice_no,'Invoice') || ' — ' || v_company, 'invoice', NEW.id);
      PERFORM private.log_rt_event('invoices', 'approval_changed',
        jsonb_build_object('invoice_id', NEW.id, 'from', OLD.approval, 'to', NEW.approval));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM private.notify_user(v_client_profile,
        CASE NEW.status WHEN 'Overdue' THEN 'destructive' ELSE 'info' END,
        'Invoice status: ' || NEW.status, COALESCE(NEW.invoice_no,'Invoice'), 'invoice', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS invoices_realtime ON public.invoices;
CREATE TRIGGER invoices_realtime
AFTER INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.trg_invoices_realtime();

-- 9. Trigger: tasks
CREATE OR REPLACE FUNCTION public.trg_tasks_realtime()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_emp_profile UUID; v_emp_name TEXT;
BEGIN
  SELECT profile_id, name INTO v_emp_profile, v_emp_name FROM public.employees WHERE id = NEW.employee_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM private.notify_user(v_emp_profile, 'info',
      'New task assigned', NEW.title, 'task', NEW.id);
    PERFORM private.log_rt_event('tasks','created', jsonb_build_object('task_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM private.notify_admins(
      CASE NEW.status WHEN 'Done' THEN 'success' ELSE 'info' END,
      v_emp_name || ' — task ' || NEW.status, NEW.title, 'task', NEW.id);
    PERFORM private.log_rt_event('tasks','status_changed',
      jsonb_build_object('task_id', NEW.id, 'from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tasks_realtime ON public.tasks;
CREATE TRIGGER tasks_realtime
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_realtime();

-- 10. Trigger: employee duty
CREATE OR REPLACE FUNCTION public.trg_employees_realtime()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.duty_status IS DISTINCT FROM OLD.duty_status THEN
    PERFORM private.notify_admins('info',
      NEW.name || ' is now ' || (CASE NEW.duty_status::text WHEN 'On' THEN 'On Duty' ELSE 'Off Duty' END),
      NULL, 'employee', NEW.id);
    PERFORM private.log_rt_event('employees','duty_changed',
      jsonb_build_object('employee_id', NEW.id, 'to', NEW.duty_status));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS employees_realtime ON public.employees;
CREATE TRIGGER employees_realtime
AFTER UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.trg_employees_realtime();
