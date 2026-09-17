import { DashboardOverview } from "@/components/dashboard-overview";
import { getDashboardHomeDataSafe } from "@/lib/workspace/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardHomeDataSafe();
  return <DashboardOverview data={data} />;
}
