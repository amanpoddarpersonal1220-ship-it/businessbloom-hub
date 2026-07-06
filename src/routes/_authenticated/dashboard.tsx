import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AdminDashboard } from "@/components/dashboards/AdminDashboard";
import { EmployeeDashboard } from "@/components/dashboards/EmployeeDashboard";
import { ClientDashboard } from "@/components/dashboards/ClientDashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { role, loading, profile } = useAuth();

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (role === "admin") return <AdminDashboard />;
  if (role === "employee") return <EmployeeDashboard />;
  return <ClientDashboard />;
}