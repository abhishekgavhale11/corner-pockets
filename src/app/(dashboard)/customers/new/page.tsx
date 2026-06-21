import { CustomerForm } from "@/components/customers/CustomerForm";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Register Customer</h1>
        <p className="mt-1 text-gray-600">
          Name and phone are required. Card ID is assigned automatically.
        </p>
      </div>

      <CustomerForm />
    </div>
  );
}
