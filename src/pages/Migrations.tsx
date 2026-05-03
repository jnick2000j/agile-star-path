import { AppLayout } from "@/components/layout/AppLayout";
import { MigrationsPanel } from "@/components/migration/MigrationsPanel";

export default function Migrations() {
  return (
    <AppLayout title="Migrations">
      <div className="container mx-auto py-6">
        <MigrationsPanel />
      </div>
    </AppLayout>
  );
}
