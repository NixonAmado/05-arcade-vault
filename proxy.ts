import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que exigen sesión.
const PROTECTED = ["/salon", "/perfil", "/bienvenida"];

const matches = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(base + "/");

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresca el token si venció y verifica la identidad (no usar getSession aquí).
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? null;
  const { pathname, search } = request.nextUrl;

  // Redirige conservando las cookies refrescadas.
  const redirectTo = (path: string, params?: Record<string, string>) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    Object.entries(params ?? {}).forEach(([k, v]) => target.searchParams.set(k, v));
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!userId) {
    if (PROTECTED.some((p) => matches(pathname, p))) {
      return redirectTo("/login", { next: pathname + search });
    }
    return response;
  }

  // Con sesión: si no tiene profile (OAuth nuevo), debe elegir username.
  if (matches(pathname, "/auth")) return response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile && !matches(pathname, "/bienvenida")) {
    return redirectTo("/bienvenida", { next: pathname + search });
  }
  if (profile && matches(pathname, "/bienvenida")) {
    return redirectTo("/biblioteca");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
