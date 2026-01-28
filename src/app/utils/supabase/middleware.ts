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
  
  // Allow public access to homepage and auth routes
  if (!user && request.nextUrl.pathname === '/') {
    return supabaseResponse
  }
  
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

  // Query staff table and their roles (via staff_roles junction table)
  if (user) {
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id, is_active')
      .eq('auth_id', user.sub)
      .single()

    if (!staffData || !staffData.is_active) {
      // Sign out the user since their staff record is invalid/inactive
      await supabase.auth.signOut()
      
      const url = request.nextUrl.clone()
      url.pathname = '/auth/sign-in'
      console.log("PROXY: Staff not found or inactive, signing out and redirecting to /auth/sign-in")
      
      const response = NextResponse.redirect(url)
      // Clear auth cookies
      response.cookies.delete('sb-auth-token')
      return response
    }

    // Query roles for this staff member
    const { data: staffRolesData, error: rolesError } = await supabase
      .from('staff_roles')
      .select('role_id')
      .eq('staff_id', staffData.id)

    const roles = staffRolesData?.map(r => r.role_id) || []

    // If no roles assigned, redirect to login
    if (roles.length === 0) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/sign-in'
      console.log("PROXY: No roles assigned, redirecting to /auth/sign-in")
      return NextResponse.redirect(url)
    }

    // Helper function to get appropriate home page based on roles
    const getHomePageForRoles = (userRoles: string[]): string => {
      // Priority order: admin > cashier > attendant > rider
      if (userRoles.includes('admin')) return '/in/orders'
      if (userRoles.includes('cashier')) return '/in/pos'
      if (userRoles.includes('attendant')) return '/in/baskets'
      if (userRoles.includes('rider')) return '/in/orders'
      return '/in/orders' // default fallback
    }

    // Redirect logged-in users from auth pages to their appropriate home page
    const isBackNavigation = request.headers.get('sec-fetch-user') !== '?1'
    if (!isBackNavigation && request.nextUrl.pathname.startsWith('/auth/sign-in')) {
      const url = request.nextUrl.clone()
      url.pathname = getHomePageForRoles(roles)
      return NextResponse.redirect(url)
    }

    // CASHIER - Can access POS, Orders, and Baskets
    if (roles.includes('cashier') && !roles.includes('admin') && !roles.includes('attendant')) {
      const allowedPaths = ['/in/pos', '/in/orders', '/in/baskets']
      const isAllowed = allowedPaths.some(path => request.nextUrl.pathname.startsWith(path))
      
      if (request.nextUrl.pathname.startsWith('/in/') && !isAllowed) {
        const url = request.nextUrl.clone()
        url.pathname = '/in/pos'
        console.log(`PROXY: Cashier unauthorized access, redirecting to /in/pos`)
        return NextResponse.redirect(url)
      }
    }

    // RIDER - Can access Orders only
    if (roles.includes('rider') && !roles.includes('admin') && !roles.includes('attendant') && !roles.includes('cashier')) {
      if (request.nextUrl.pathname.startsWith('/in/') && !request.nextUrl.pathname.startsWith('/in/orders')) {
        const url = request.nextUrl.clone()
        url.pathname = '/in/orders'
        console.log(`PROXY: Rider unauthorized access, redirecting to /in/orders`)
        return NextResponse.redirect(url)
      }
    }

    // ATTENDANT - Can access Orders, Baskets, Manage (but not POS)
    if (roles.includes('attendant') && !roles.includes('admin') && !roles.includes('cashier')) {
      const allowedPaths = ['/in/orders', '/in/baskets', '/in/manage']
      const isAllowed = allowedPaths.some(path => request.nextUrl.pathname.startsWith(path))
      
      if (request.nextUrl.pathname.startsWith('/in/') && !isAllowed) {
        const url = request.nextUrl.clone()
        url.pathname = '/in/baskets'
        console.log(`PROXY: Attendant unauthorized access, redirecting to /in/baskets`)
        return NextResponse.redirect(url)
      }
    }

    // ADMIN - Can access everything, so no restrictions
    // But protect /in/analytics for admin only
    if (!roles.includes('admin') && request.nextUrl.pathname.startsWith('/in/analytics')) {
      const url = request.nextUrl.clone()
      url.pathname = '/in/orders' // or wherever appropriate home page is
      console.log(`PROXY: Non-admin unauthorized access to analytics, redirecting`)
      return NextResponse.redirect(url)
    }

    // API-level access control
    // Only admin can access /api/staff
    if (!roles.includes('admin') && request.nextUrl.pathname.startsWith('/api/staff')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Only admin can access /api/analytics
    if (!roles.includes('admin') && request.nextUrl.pathname.startsWith('/api/analytics')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Only admin and attendant can access /api/manage
    if (
      (!roles.includes('admin') && !roles.includes('attendant')) &&
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