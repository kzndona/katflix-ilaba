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
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/api')
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

    // Helper function to get appropriate home page for role
    const getHomePageForRole = (userRole: string): string => {
      switch (userRole) {
        case 'cashier':
          return '/in/pos'
        case 'rider':
          return '/in/orders'
        case 'attendant':
          return '/in/baskets'
        case 'cashier_attendant':
          return '/in/baskets'
        case 'admin':
          return '/in/orders'
        default:
          return '/in/orders'
      }
    }

    // Redirect to login if no role found
    if (!role) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/sign-in'
      return NextResponse.redirect(url)
    }

    // Redirect logged-in users from auth pages to their appropriate home page
    const isBackNavigation = request.headers.get('sec-fetch-user') !== '?1'
    if (!isBackNavigation && request.nextUrl.pathname.startsWith('/auth/sign-in')) {
      const url = request.nextUrl.clone()
      url.pathname = getHomePageForRole(role)
      return NextResponse.redirect(url)
    }

    // CASHIER - Can only access POS
    if (role === 'cashier') {
      if (request.nextUrl.pathname.startsWith('/in/') && !request.nextUrl.pathname.startsWith('/in/pos')) {
        const url = request.nextUrl.clone()
        url.pathname = '/in/pos'
        console.log(`PROXY: Cashier unauthorized access, redirecting to /in/pos`)
        return NextResponse.redirect(url)
      }
    }

    // RIDER - Can access Orders only
    if (role === 'rider') {
      if (request.nextUrl.pathname.startsWith('/in/') && !request.nextUrl.pathname.startsWith('/in/orders')) {
        const url = request.nextUrl.clone()
        url.pathname = '/in/orders'
        console.log(`PROXY: Rider unauthorized access, redirecting to /in/orders`)
        return NextResponse.redirect(url)
      }
    }

    // ATTENDANT - Can access Orders, Baskets, Manage
    if (role === 'attendant') {
      const allowedPaths = ['/in/orders', '/in/baskets', '/in/manage']
      const isAllowed = allowedPaths.some(path => request.nextUrl.pathname.startsWith(path))
      
      if (request.nextUrl.pathname.startsWith('/in/') && !isAllowed) {
        const url = request.nextUrl.clone()
        url.pathname = '/in/baskets'
        console.log(`PROXY: Attendant unauthorized access, redirecting to /in/baskets`)
        return NextResponse.redirect(url)
      }
    }

    // CASHIER_ATTENDANT - Can access POS, Orders, Baskets, Manage
    if (role === 'cashier_attendant') {
      const allowedPaths = ['/in/pos', '/in/orders', '/in/baskets', '/in/manage']
      const isAllowed = allowedPaths.some(path => request.nextUrl.pathname.startsWith(path))
      
      if (request.nextUrl.pathname.startsWith('/in/') && !isAllowed) {
        const url = request.nextUrl.clone()
        url.pathname = '/in/baskets'
        console.log(`PROXY: Cashier Attendant unauthorized access, redirecting to /in/baskets`)
        return NextResponse.redirect(url)
      }
    }

    // ADMIN - Can access everything, so no restrictions

    // API-level access control
    // Only admin can access /api/staff
    if (role !== 'admin' && request.nextUrl.pathname.startsWith('/api/staff')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Only admin, attendant, and cashier_attendant can access /api/manage
    if (
      (role !== 'admin' && role !== 'attendant' && role !== 'cashier_attendant') &&
      request.nextUrl.pathname.startsWith('/api/manage')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
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