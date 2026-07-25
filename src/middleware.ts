import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/auth.config";
import {
  getDefaultHomePath,
  hasPermission,
  type StaffRole,
} from "@/lib/auth/roles";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const role = req.auth?.user?.role as StaffRole | undefined;
  const homePath = role ? getDefaultHomePath(role) : "/login";

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL(homePath, req.url));
  }

  if (req.nextUrl.pathname === "/") {
    return NextResponse.redirect(
      new URL(isLoggedIn ? homePath : "/login", req.url)
    );
  }

  if (isLoggedIn && role) {
    if (
      (req.nextUrl.pathname.startsWith("/notebook") ||
        req.nextUrl.pathname.startsWith("/counter")) &&
      !hasPermission(role, "NOTEBOOK_VIEW")
    ) {
      return NextResponse.redirect(new URL("/customers", req.url));
    }

    if (req.nextUrl.pathname === "/dashboard") {
      return NextResponse.redirect(new URL(getDefaultHomePath(role), req.url));
    }

    if (
      req.nextUrl.pathname.startsWith("/admin") &&
      !hasPermission(role, "STAFF_VIEW")
    ) {
      return NextResponse.redirect(new URL("/customers", req.url));
    }

    if (
      req.nextUrl.pathname.startsWith("/staff") &&
      !hasPermission(role, "STAFF_VIEW")
    ) {
      return NextResponse.redirect(new URL("/customers", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
