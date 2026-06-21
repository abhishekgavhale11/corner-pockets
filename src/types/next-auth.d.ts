import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: import("@/lib/auth/roles").StaffRole;
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    role: import("@/lib/auth/roles").StaffRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: import("@/lib/auth/roles").StaffRole;
  }
}
