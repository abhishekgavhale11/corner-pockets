"use client";

import { useActionState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardTitle } from "@/components/ui/Card";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await signIn("credentials", {
        username: String(formData.get("username") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });

      if (result?.error) {
        return { error: "Invalid username or password" };
      }

      window.location.href = "/dashboard";
      return null;
    },
    null
  );

  return (
    <Card>
      <CardTitle className="mb-6 text-center">Staff Sign In</CardTitle>
      <form action={formAction} className="space-y-5">
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            required
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={isPending} fullWidth size="lg">
          {isPending ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </Card>
  );
}
