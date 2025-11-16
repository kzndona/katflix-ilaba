import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value }) => supabaseResponse.cookies.set(name, value))
        },
      },
    }
  )



  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.



  // IMPORTANT: Don't remove getClaims()
  const { data } = await supabase.auth.getClaims()




  const user = data?.claims
  
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/auth/sign-in')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/auth/sign-in'
    console.log("PROXY: No user session, redirecting to /auth/sign-in");
    return NextResponse.redirect(url)
  }



  // Query staff table for user role
  if (user) {
    const { data: staffData, error } = await supabase
      .from('staff')
      .select('role')
      .eq('auth_id', user.sub) // user.sub is the Supabase auth user id
      .single()

    const role = staffData?.role

    // Admin-only routes
    if (role !== 'admin') {
      
      // Restrict access to /in/accounts pages
      if (request.nextUrl.pathname.startsWith("/in/accounts")) {
        const url = request.nextUrl.clone()
        url.pathname = "/in/orders" // redirect non-admin
        console.log("PROXY: Unauthorized access to /in/accounts/staff, redirecting to /in/orders");
        return NextResponse.redirect(url)
      }
  
      // Restrict access to admin-only API
      if (request.nextUrl.pathname.startsWith("/api/staff")) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    // Inventory management routes (admin and attendant only)
    if ((role !== 'admin' && role !== 'attendant' && role !== 'cashier_attendant')) {
      
      // Restrict access to /in/manage pages
      if (request.nextUrl.pathname.startsWith("/in/manage")) {
        const url = request.nextUrl.clone()
        url.pathname = "/in/orders" // redirect non-admin
        console.log("PROXY: Unauthorized access to /in/manage, redirecting to /in/orders");
        return NextResponse.redirect(url)
      }
  
      // Restrict access to inventory API
      if (request.nextUrl.pathname.startsWith("/api/inventory")) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }
  }





  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!





  return supabaseResponse
}