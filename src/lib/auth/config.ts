import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/connect";
import Staff from "@/models/Staff";
import { ensureDefaultStaff } from "@/lib/auth/ensure-default-staff";
import { loginSchema } from "@/lib/validators/auth";
import { authConfig } from "@/lib/auth/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        await connectDB();
        await ensureDefaultStaff();

        const staff = await Staff.findOne({
          username: parsed.data.username.toLowerCase(),
          isActive: true,
        });

        if (!staff) {
          return null;
        }

        const isValid = await bcrypt.compare(
          parsed.data.password,
          staff.passwordHash
        );

        if (!isValid) {
          return null;
        }

        return {
          id: staff._id.toString(),
          name: staff.name,
          username: staff.username,
          role: staff.role,
        };
      },
    }),
  ],
});
