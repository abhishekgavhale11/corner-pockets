import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";

export default function AdminReportsPage() {
  return (
    <div className="space-y-3">
      <Link
        href="/admin"
        className="text-xs font-medium text-emerald-800 hover:underline"
      >
        ← Admin
      </Link>
      <Card>
        <CardTitle className="text-sm">Reports</CardTitle>
        <p className="mt-1 text-xs text-gray-500">Coming soon.</p>
      </Card>
    </div>
  );
}
