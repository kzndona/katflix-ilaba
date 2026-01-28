# Google Maps - Vercel Deployment Fix

## Issues Fixed

### 1. **Script Loading Strategy** ✅

- **Before**: `strategy="lazyOnload"` - delayed loading causing timing issues
- **After**: `strategy="beforeInteractive"` - ensures maps load before page interaction
- **File**: [src/app/layout.tsx](src/app/layout.tsx#L26)

### 2. **Missing Libraries** ✅

- **Added**: `marker` library to Google Maps initialization
- **Updated**: Both layout.tsx and LocationPicker fallback scripts
- **Ensures**: All required libraries load

### 3. **Enhanced Debugging** ✅

- Added detailed console logs with emojis for easy troubleshooting
- Better timeout handling (5 seconds max wait)
- Clear error messages

---

## Verification Checklist

### Step 1: Verify Environment Variables in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Confirm these are set:
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ✓
   - `NEXT_PUBLIC_KATFLIX_LATITUDE` ✓
   - `NEXT_PUBLIC_KATFLIX_LONGITUDE` ✓
3. If missing, add them and **redeploy**

### Step 2: Check Google Maps API Permissions

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services** → **Enabled APIs**
4. Verify these are enabled:
   - Maps JavaScript API ✓
   - Places API ✓
   - Directions API ✓
   - Geometry API ✓

### Step 3: Check API Key Restrictions

1. Go to **APIs & Services** → **Credentials**
2. Click your API Key
3. Under **Application restrictions**:
   - Should be: `HTTP referrers (websites)`
   - Add both:
     - `http://localhost:3000` (local testing)
     - `https://yourdomain.vercel.app/*` (production)
4. Under **API restrictions**:
   - Should NOT restrict to specific APIs (or include all above)

### Step 4: Test Locally

```bash
npm run dev
# Visit http://localhost:3000/in/pos
# Go to Step 5 (Handling)
# Click "Pin Location" button
# Check browser console for:
# ✅ "Google Maps already loaded globally" OR
# ✅ "Google Maps script loaded successfully"
```

### Step 5: Deploy & Test on Vercel

1. Push changes to GitHub
2. Vercel auto-deploys
3. Visit `https://yourdomain.vercel.app/in/pos`
4. Open browser DevTools (F12)
5. Go to Console tab
6. Reload page
7. Should see one of:
   - `✅ Google Maps already loaded globally`
   - `✅ Google Maps API loaded after waiting`

---

## If Maps Still Don't Load

### Check These in Browser Console:

```javascript
// Run these commands in DevTools Console (F12)

// 1. Check if API key exists
console.log(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

// 2. Check if Google Maps loaded
console.log(window.google?.maps ? "✅ Loaded" : "❌ Not loaded");

// 3. Check all scripts in page
document
  .querySelectorAll('script[src*="maps.googleapis"]')
  .forEach((s) => console.log(s.src));

// 4. Check if Places library loaded
console.log(
  window.google?.maps?.places ? "✅ Places API loaded" : "❌ Not loaded",
);
```

### Common Issues & Fixes:

| Issue                             | Cause                           | Fix                                           |
| --------------------------------- | ------------------------------- | --------------------------------------------- |
| `❌ API key not found`            | Env var not set in Vercel       | Add to Vercel Settings → redeploy             |
| `❌ Invalid API key`              | Wrong key or copy-paste error   | Verify key in Google Cloud Console            |
| `❌ CORS error`                   | API key restrictions too strict | Allow `*.vercel.app` domain                   |
| `❌ Maps.locations is undefined`  | Places library not loaded       | Check `&libraries=places` in script URL       |
| Map shows but search doesn't work | Autocomplete not initialized    | Check browser console for autocomplete errors |

---

## Files Modified

1. **[src/app/layout.tsx](src/app/layout.tsx#L26)**
   - Changed strategy from `lazyOnload` → `beforeInteractive`
   - Added `marker` library

2. **[src/app/components/LocationPicker.tsx](src/app/components/LocationPicker.tsx#L67)**
   - Added enhanced debugging logs
   - Added timeout handling
   - Added `marker` library to fallback script

---

## What Changed

### Before:

```tsx
<Script
  src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,geometry`}
  strategy="lazyOnload"
/>
```

### After:

```tsx
<Script
  src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,geometry,marker`}
  strategy="beforeInteractive"
/>
```

---

## Next Steps

1. ✅ Changes deployed
2. ⏳ Rebuild Vercel deployment (if not auto-triggered)
3. 🔍 Check browser console in deployed version
4. 📍 Test "Pin Location" feature in POS Step 5
5. 🎯 Verify maps load and search works

**Questions?** Check the detailed logs in browser console F12 → Console tab
