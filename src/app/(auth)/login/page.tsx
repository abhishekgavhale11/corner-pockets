import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-950 px-4 py-8">
      <div className="mb-8 text-center text-white">
        <p className="text-sm font-medium uppercase tracking-wider text-emerald-300">
          Snooker Club
        </p>
        <h1 className="mt-1 text-3xl font-bold">Corner Pockets</h1>
        <p className="mt-2 text-emerald-200">Wallet Management</p>
      </div>

      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}
