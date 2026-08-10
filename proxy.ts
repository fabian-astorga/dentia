import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Protege todo lo que vive bajo /panel — exige sesión activa antes de
// renderizar. La excepción es /panel/login, que necesita ser accesible
// sin sesión (si no, nadie podría loguearse nunca).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === "/panel/login";

  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL("/panel/login", request.url));
  }

  return response;
}

export const config = {
  matcher: "/panel/:path*",
};