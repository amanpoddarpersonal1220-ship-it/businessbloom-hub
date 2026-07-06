
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin','employee','client');
CREATE TYPE public.order_type AS ENUM ('PO','SO');
CREATE TYPE public.order_status AS ENUM ('Pending','Confirmed','Invoiced','Paid');
CREATE TYPE public.confirmation_status AS ENUM ('Pending','Accepted','Declined','ChangesRequested');
CREATE TYPE public.invoice_status AS ENUM ('Sent','Approved','Declined','Overdue');
CREATE TYPE public.task_status AS ENUM ('Todo','InProgress','Done');
CREATE TYPE public.ledger_type AS ENUM ('charge','payment','penalty');
CREATE TYPE public.duty_status AS ENUM ('On','Off');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone_masked TEXT,
  role app_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ EMPLOYEES ============
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  order_limit NUMERIC NOT NULL DEFAULT 100000,
  duty_status duty_status NOT NULL DEFAULT 'Off',
  base_salary NUMERIC NOT NULL DEFAULT 30000,
  hra NUMERIC NOT NULL DEFAULT 8000,
  allowances NUMERIC NOT NULL DEFAULT 4000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;

-- ============ CLIENTS ============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  gst_number TEXT,
  pan TEXT,
  credit_limit NUMERIC NOT NULL DEFAULT 500000,
  credit_terms INTEGER NOT NULL DEFAULT 30,
  penalty_rate NUMERIC NOT NULL DEFAULT 1.5,
  verified BOOLEAN NOT NULL DEFAULT false,
  assigned_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

CREATE TABLE public.gst_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  gst_number TEXT,
  status TEXT NOT NULL DEFAULT 'unverified',
  provider TEXT NOT NULL DEFAULT 'manual',
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gst_verification TO authenticated;
GRANT ALL ON public.gst_verification TO service_role;

-- helper: map auth user -> employee/client id
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE profile_id = auth.uid() LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.clients WHERE profile_id = auth.uid() LIMIT 1
$$;

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no TEXT NOT NULL DEFAULT ('ORD-' || substr(gen_random_uuid()::text,1,8)),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  type order_type NOT NULL DEFAULT 'SO',
  status order_status NOT NULL DEFAULT 'Pending',
  confirmation confirmation_status NOT NULL DEFAULT 'Pending',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  value NUMERIC NOT NULL DEFAULT 0,
  needs_admin_approval BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

-- ============ INVOICES ============
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL DEFAULT ('INV-' || substr(gen_random_uuid()::text,1,8)),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'Sent',
  approval confirmation_status NOT NULL DEFAULT 'Pending',
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

-- ============ LEDGER ============
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type ledger_type NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  running_balance NUMERIC NOT NULL DEFAULT 0,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;

-- ============ CREDIT PURSE ============
CREATE TABLE public.credit_purse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  credit_limit NUMERIC NOT NULL DEFAULT 500000,
  used NUMERIC NOT NULL DEFAULT 0,
  remaining NUMERIC NOT NULL DEFAULT 500000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_purse TO authenticated;
GRANT ALL ON public.credit_purse TO service_role;

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'Todo',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_name TEXT,
  action TEXT NOT NULL,
  target TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

-- ============ RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gst_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_purse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- employees
CREATE POLICY "employees read" ON public.employees FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR profile_id = auth.uid() OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "admin manage employees" ON public.employees FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "employee update self" ON public.employees FOR UPDATE TO authenticated USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- clients
CREATE POLICY "clients read" ON public.clients FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR profile_id = auth.uid()
  OR (public.has_role(auth.uid(),'employee') AND assigned_employee_id = public.current_employee_id())
);
CREATE POLICY "admin manage clients" ON public.clients FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- gst_verification
CREATE POLICY "gst read" ON public.gst_verification FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR client_id = public.current_client_id());
CREATE POLICY "admin manage gst" ON public.gst_verification FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- orders
CREATE POLICY "orders read" ON public.orders FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR client_id = public.current_client_id()
  OR employee_id = public.current_employee_id()
);
CREATE POLICY "admin manage orders" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "employee insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'employee') AND employee_id = public.current_employee_id());
CREATE POLICY "employee update own orders" ON public.orders FOR UPDATE TO authenticated USING (employee_id = public.current_employee_id()) WITH CHECK (employee_id = public.current_employee_id());
CREATE POLICY "client respond orders" ON public.orders FOR UPDATE TO authenticated USING (client_id = public.current_client_id()) WITH CHECK (client_id = public.current_client_id());

-- invoices
CREATE POLICY "invoices read" ON public.invoices FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR client_id = public.current_client_id()
  OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = invoices.client_id AND c.assigned_employee_id = public.current_employee_id())
);
CREATE POLICY "admin manage invoices" ON public.invoices FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "client respond invoices" ON public.invoices FOR UPDATE TO authenticated USING (client_id = public.current_client_id()) WITH CHECK (client_id = public.current_client_id());

-- ledger
CREATE POLICY "ledger read" ON public.ledger_entries FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR client_id = public.current_client_id()
  OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = ledger_entries.client_id AND c.assigned_employee_id = public.current_employee_id())
);
CREATE POLICY "admin manage ledger" ON public.ledger_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- credit purse
CREATE POLICY "purse read" ON public.credit_purse FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR client_id = public.current_client_id()
  OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = credit_purse.client_id AND c.assigned_employee_id = public.current_employee_id())
);
CREATE POLICY "admin manage purse" ON public.credit_purse FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tasks
CREATE POLICY "tasks read" ON public.tasks FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR employee_id = public.current_employee_id());
CREATE POLICY "admin manage tasks" ON public.tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "employee update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (employee_id = public.current_employee_id()) WITH CHECK (employee_id = public.current_employee_id());

-- audit log
CREATE POLICY "audit read admin" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
