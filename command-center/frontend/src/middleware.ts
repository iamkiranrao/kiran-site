import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard");
  const isOnLogin = req.nextUrl.pathname === "/login";

  if (isOnDashboard && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.url));
  }

  if (isOnLogin && isLoggedIn) {
    return Response.redirect(new URL("/dashboard/teardowns", req.url));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
