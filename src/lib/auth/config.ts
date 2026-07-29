import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
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
          username: parsed.data.username,
          isActive: true,
        }).lean();

        // TEMPORARY DEBUG LOGGING — remove after investigation.
        console.log("[auth:debug] username received:", parsed.data.username);
        console.log("[auth:debug] user found:", !!staff);
        console.log("[auth:debug] isActive true:", staff?.isActive === true);
        console.log(
          "[auth:debug] password field exists:",
          !!staff && Object.prototype.hasOwnProperty.call(staff, "password")
        );

        if (!staff?.password) {
          return null;
        }

        const passwordMatches = staff.password === parsed.data.password;
        console.log("[auth:debug] password comparison result:", passwordMatches);

        if (!passwordMatches) {
          return null;
        }

        return {
          id: staff._id.toString(),
          name: staff.username,
          username: staff.username,
          role: staff.role,
        };
      },
    }),
  ],
});
