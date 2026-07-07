
-- ============================================================
-- 1. Move SECURITY DEFINER helper functions to a private, non-API schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION private.current_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT id FROM public.employees WHERE profile_id = auth.uid() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION private.current_client_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT id FROM public.clients WHERE profile_id = auth.uid() LIMIT 1 $$;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.current_employee_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.current_client_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_employee_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_client_id() TO authenticated, service_role;

-- ============================================================
-- 2. Recreate all policies to reference private.* helpers
-- ============================================================

-- credit_purse
DROP POLICY "admin manage purse" ON public.credit_purse;
CREATE POLICY "admin manage purse" ON public.credit_purse FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY "purse read" ON public.credit_purse;
CREATE POLICY "purse read" ON public.credit_purse FOR SELECT
  USING (private.has_role(auth.uid(),'admin') OR client_id = private.current_client_id()
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = credit_purse.client_id AND c.assigned_employee_id = private.current_employee_id()));

-- profiles
DROP POLICY "admin manage profiles" ON public.profiles;
CREATE POLICY "admin manage profiles" ON public.profiles FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'employee'));
DROP POLICY "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR private.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR private.has_role(auth.uid(),'admin'));

-- user_roles
DROP POLICY "admin manage roles" ON public.user_roles;
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));

-- tasks
DROP POLICY "admin manage tasks" ON public.tasks;
CREATE POLICY "admin manage tasks" ON public.tasks FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY "employee update own tasks" ON public.tasks;
CREATE POLICY "employee update own tasks" ON public.tasks FOR UPDATE
  USING (employee_id = private.current_employee_id()) WITH CHECK (employee_id = private.current_employee_id());
DROP POLICY "tasks read" ON public.tasks;
CREATE POLICY "tasks read" ON public.tasks FOR SELECT
  USING (private.has_role(auth.uid(),'admin') OR employee_id = private.current_employee_id());

-- audit_log (also tighten: only admin/employee may insert)
DROP POLICY "audit insert" ON public.audit_log;
CREATE POLICY "audit insert" ON public.audit_log FOR INSERT
  WITH CHECK (actor_id = auth.uid() AND (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'employee')));
DROP POLICY "audit read admin" ON public.audit_log;
CREATE POLICY "audit read admin" ON public.audit_log FOR SELECT
  USING (private.has_role(auth.uid(),'admin'));

-- employees (also tighten read: employees only see own row)
DROP POLICY "admin manage employees" ON public.employees;
CREATE POLICY "admin manage employees" ON public.employees FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY "employees read" ON public.employees;
CREATE POLICY "employees read" ON public.employees FOR SELECT
  USING (private.has_role(auth.uid(),'admin') OR profile_id = auth.uid());
-- "employee update self" unchanged (no helper), trigger below restricts columns

-- clients
DROP POLICY "admin manage clients" ON public.clients;
CREATE POLICY "admin manage clients" ON public.clients FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY "clients read" ON public.clients;
CREATE POLICY "clients read" ON public.clients FOR SELECT
  USING (private.has_role(auth.uid(),'admin') OR profile_id = auth.uid()
    OR (private.has_role(auth.uid(),'employee') AND assigned_employee_id = private.current_employee_id()));

-- gst_verification
DROP POLICY "admin manage gst" ON public.gst_verification;
CREATE POLICY "admin manage gst" ON public.gst_verification FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY "gst read" ON public.gst_verification;
CREATE POLICY "gst read" ON public.gst_verification FOR SELECT
  USING (private.has_role(auth.uid(),'admin') OR client_id = private.current_client_id());

-- orders
DROP POLICY "admin manage orders" ON public.orders;
CREATE POLICY "admin manage orders" ON public.orders FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY "client respond orders" ON public.orders;
CREATE POLICY "client respond orders" ON public.orders FOR UPDATE
  USING (client_id = private.current_client_id()) WITH CHECK (client_id = private.current_client_id());
DROP POLICY "employee insert orders" ON public.orders;
CREATE POLICY "employee insert orders" ON public.orders FOR INSERT
  WITH CHECK (private.has_role(auth.uid(),'employee') AND employee_id = private.current_employee_id());
DROP POLICY "employee update own orders" ON public.orders;
CREATE POLICY "employee update own orders" ON public.orders FOR UPDATE
  USING (employee_id = private.current_employee_id()) WITH CHECK (employee_id = private.current_employee_id());
DROP POLICY "orders read" ON public.orders;
CREATE POLICY "orders read" ON public.orders FOR SELECT
  USING (private.has_role(auth.uid(),'admin') OR client_id = private.current_client_id() OR employee_id = private.current_employee_id());

-- invoices
DROP POLICY "admin manage invoices" ON public.invoices;
CREATE POLICY "admin manage invoices" ON public.invoices FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY "client respond invoices" ON public.invoices;
CREATE POLICY "client respond invoices" ON public.invoices FOR UPDATE
  USING (client_id = private.current_client_id()) WITH CHECK (client_id = private.current_client_id());
DROP POLICY "invoices read" ON public.invoices;
CREATE POLICY "invoices read" ON public.invoices FOR SELECT
  USING (private.has_role(auth.uid(),'admin') OR client_id = private.current_client_id()
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = invoices.client_id AND c.assigned_employee_id = private.current_employee_id()));

-- ledger_entries
DROP POLICY "admin manage ledger" ON public.ledger_entries;
CREATE POLICY "admin manage ledger" ON public.ledger_entries FOR ALL
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY "ledger read" ON public.ledger_entries;
CREATE POLICY "ledger read" ON public.ledger_entries FOR SELECT
  USING (private.has_role(auth.uid(),'admin') OR client_id = private.current_client_id()
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = ledger_entries.client_id AND c.assigned_employee_id = private.current_employee_id()));

-- Drop old public helper functions (no longer referenced, and not part of exposed API)
DROP FUNCTION public.has_role(uuid, app_role);
DROP FUNCTION public.current_employee_id();
DROP FUNCTION public.current_client_id();

-- ============================================================
-- 3. Column-guard triggers to stop non-admins tampering with sensitive fields
-- ============================================================

-- profiles: non-admin may not change role
CREATE OR REPLACE FUNCTION private.guard_profiles_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF private.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_profiles_update ON public.profiles;
CREATE TRIGGER guard_profiles_update BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_profiles_update();

-- employees: non-admin may only change duty_status
CREATE OR REPLACE FUNCTION private.guard_employees_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF private.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  IF NEW.base_salary IS DISTINCT FROM OLD.base_salary
     OR NEW.hra IS DISTINCT FROM OLD.hra
     OR NEW.allowances IS DISTINCT FROM OLD.allowances
     OR NEW.order_limit IS DISTINCT FROM OLD.order_limit
     OR NEW.name IS DISTINCT FROM OLD.name
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'Employees may only change their duty status';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_employees_update ON public.employees;
CREATE TRIGGER guard_employees_update BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION private.guard_employees_update();

-- invoices: non-admin may only change approval
CREATE OR REPLACE FUNCTION private.guard_invoices_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF private.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.invoice_no IS DISTINCT FROM OLD.invoice_no
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at THEN
    RAISE EXCEPTION 'Clients may only respond to invoices';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_invoices_update ON public.invoices;
CREATE TRIGGER guard_invoices_update BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION private.guard_invoices_update();

-- orders: non-admin may only change confirmation and status
CREATE OR REPLACE FUNCTION private.guard_orders_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF private.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  IF NEW.value IS DISTINCT FROM OLD.value
     OR NEW.needs_admin_approval IS DISTINCT FROM OLD.needs_admin_approval
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.items IS DISTINCT FROM OLD.items
     OR NEW.order_no IS DISTINCT FROM OLD.order_no THEN
    RAISE EXCEPTION 'Not allowed to modify protected order fields';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_orders_update ON public.orders;
CREATE TRIGGER guard_orders_update BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.guard_orders_update();
