// @ts-nocheck
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database.types";
import { isMockMode } from "@/lib/utils/mock";

const publicPaths = [
  "/auth",
  "/book",
  "/api/availability",
  "/api/bookings",
  "/api/health",
  "/api/public",
];

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => pathname.startsWith(path));
}

export async function updateSession(request: NextRequest) {
  if (isMockMode()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !isPublicPath(request.nextUrl.pathname)
  ) {
    // Redirect to login if not authenticated (except for public pages/APIs)
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
