# Task 25: Comprehensive Electron Fix Plan - All Issues Working Together

## 🎯 **CRITICAL INSIGHT**: All 8 issues are interconnected - fixing one breaks others

## 📋 **Current Issues Analysis**

### **Task 1: React/ReactDOM Undefined** 
```
window.React: undefined
window.ReactDOM: undefined  
window.next: undefined
```
**Root Cause**: Framework scripts not loading or executing properly
**Dependencies**: Tasks 2, 4, 6, 7

**File Locations**:
- **Main Issue**: `apps/web/out/_next/static/chunks/framework-f4023498a1ccedf8.js`
- **Debug Location**: `apps/web/electron/main-simple.js:116-120` (DOM Content Loaded check)
- **Console Output**: Electron renderer process logs

**Relevant Code**:
```javascript
// apps/web/electron/main-simple.js:116-120
🔍 DOM Content Loaded - Initial check:
- window.React: undefined  
- window.ReactDOM: undefined
- window.next: undefined
```

### **Task 2: Font Resource Loading Failure**
```
e4af272ccee01ff0-s.p.woff2: Failed to load resource: net::ERR_FILE_NOT_FOUND
```
**Root Cause**: Path resolution issues
**Current Status**: ✅ FIXED (relative paths working)

**File Locations**:
- **Font File**: `apps/web/out/_next/static/media/e4af272ccee01ff0-s.p.woff2`
- **HTML Reference**: `apps/web/out/index.html:75` (preload link)
- **Fix Script**: `apps/web/scripts/fix-electron-paths-simple.js:24-48`

**Relevant Code**:
```html
<!-- apps/web/out/index.html:75 (FIXED) -->
<link rel="preload" href="_next/static/media/e4af272ccee01ff0-s.p.woff2" as="font" type="font/woff2" crossorigin="anonymous"/>
```

```javascript
// apps/web/scripts/fix-electron-paths-simple.js:28,31
.replace(/href="\/([^"]+)"/g, 'href="$1"')    // Fixed absolute → relative
.replace(/src="\/([^"]+)"/g, 'src="$1"')      // Fixed absolute → relative
```

### **Task 3: Electron Security Warnings**
```
Electron Security Warning (Disabled webSecurity)
```
**Root Cause**: Development configuration  
**Priority**: Low (cosmetic, doesn't break functionality)

**File Locations**:
- **Main Config**: `apps/web/electron/main-simple.js:105-121` (BrowserWindow webPreferences)
- **Console Output**: Electron renderer security warnings

**Relevant Code**:
```javascript
// apps/web/electron/main-simple.js:105-121  
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  enableRemoteModule: false,
  webSecurity: false,              // ⚠️ Causes security warning
  allowRunningInsecureContent: true, // ⚠️ Causes security warning
  preload: path.join(__dirname, 'preload.js'),
}
```

### **Task 4: Location.assign Read-Only Error**
```
TypeError: Cannot assign to read only property 'assign' of object '[object Location]'
    at url-validation.ts:157:25
    at uD (react-dom.production.min.js:243:322)
```
**Root Cause**: Electron makes location properties read-only
**Current Status**: ⚠️ PARTIALLY FIXED (preload patch exists but not effective)

**File Locations**:
- **Error Source**: Next.js framework trying to access `location.assign`
- **Current Patch**: `apps/web/electron/preload.js:45-65` (location patch)
- **Build Patch**: `apps/web/scripts/fix-electron-paths-simple.js:95-117` (JS file patching)
- **Problematic File**: `apps/web/out/_next/static/chunks/415-462d89c68d055205.js`

**Relevant Code**:
```javascript
// apps/web/electron/preload.js:45-65 (Current patch - not early enough)
const originalHref = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
window.__electronLocationAssign = function(url) {
  console.log('[ELECTRON] location.assign redirected to href:', url);
  // ... wrapper implementation
};

// apps/web/scripts/fix-electron-paths-simple.js:97-99 (Build-time patch)
content = content.replace(
  /location\.assign\s*\(/g,
  '(function(url){try{location.href=url}catch(e){console.warn("location navigation failed:",e)}})('
);
```

### **Task 5: Next.js Data Loading Failure** 
```
/C:/_next/data/electron-static-build/C:/Users/zdhpe/Desktop/New%20folder/OpenCut/apps/web/out/index.html.json:1  Failed to load resource: net::ERR_FILE_NOT_FOUND
```
**Root Cause**: Static export trying to load JSON data files that don't exist
**Impact**: Prevents page hydration

**File Locations**:
- **Next.js Config**: `apps/web/next.config.ts:15-32` (static export settings)
- **Page Source**: `apps/web/src/app/page.tsx` (main landing page)
- **Missing Data**: Non-existent JSON files in `_next/data/` directory
- **Build Output**: `apps/web/out/` (static export directory)

**Relevant Code**:
```typescript
// apps/web/next.config.ts:30-32 (Current config needs enhancement)
const nextConfig: NextConfig = isElectron ? Object.assign({}, baseConfig, {
  trailingSlash: true,
  output: 'export',
  // Missing: proper static export data handling
});

// apps/web/src/app/page.tsx (May have getStaticProps causing data requests)
// Need to check for data fetching that requires JSON files
```

### **Task 6: Error Page Script Loading Failure**
```
_error-c038c2671621d423.js: Failed to load resource: net::ERR_FILE_NOT_FOUND
```
**Root Cause**: Path resolution for error handling scripts
**Current Status**: ✅ FIXED (relative paths working)

**File Locations**:
- **Script File**: `apps/web/out/_next/static/chunks/pages/_error-c038c2671621d423.js`
- **HTML Reference**: `apps/web/out/index.html` (script tags)
- **Fix Applied**: `apps/web/scripts/fix-electron-paths-simple.js:31` (path transformation)

**Relevant Code**:
```html
<!-- apps/web/out/index.html (FIXED) -->
<script src="_next/static/chunks/pages/_error-c038c2671621d423.js" defer=""></script>
<!-- Was: <script src="/_next/static/chunks/pages/_error-c038c2671621d423.js" defer=""></script> -->
```

### **Task 7: Script Loading Error Chain**
```
Error: Failed to load script: /_next/static/chunks/pages/_error-c038c2671621d423.js
    at t.onerror (route-loader.ts:167:29)
index.tsx:314 Error rendering page: Error: Failed to load script
```
**Root Cause**: Cascade from Task 6
**Current Status**: ✅ FIXED (relative paths working)

**File Locations**:
- **Error Origin**: Next.js route loader trying to load error page script
- **Route Loader**: `_next/static/chunks/` (Next.js internal routing)
- **Error Handler**: Next.js internal error boundary system
- **Console Output**: `index.tsx:314` (Next.js error logging)

**Relevant Code**:
```javascript
// Error cascade pattern:
// 1. /_next/static/chunks/pages/_error-c038c2671621d423.js fails to load (Task 6)
// 2. route-loader.ts:167 triggers onerror callback  
// 3. index.tsx:314 logs "Error rendering page"
// 4. React error boundary activated
```

### **Task 8: React Not Rendering Despite DOM Ready**
```
document.querySelector("#__next"): true
❌ Next.js app not rendered
🔍 Storage service initialization test...
❌ Storage service not available
```
**Root Cause**: React scripts load but don't execute due to location.assign errors
**Dependencies**: Tasks 1, 4, 5

**File Locations**:
- **DOM Check**: `apps/web/electron/main-simple.js:380-390` (debug injection)
- **React Root**: `apps/web/out/index.html` (`#__next` div)
- **Hydration Source**: Next.js internal hydration process
- **Storage Test**: `apps/web/electron/main-simple.js:400-410` (storage availability check)

**Relevant Code**:
```javascript
// apps/web/electron/main-simple.js:380-390 (Debug check showing the issue)
🔍 After delay check (2s):
- window.React: undefined
- window.ReactDOM: undefined
- document.querySelector("#__next"): true  // ← DOM exists but empty
❌ Next.js app not rendered                // ← React didn't hydrate

// apps/web/out/index.html (Empty React root)
<div id="__next"><div class="__className_e8ce0c font-sans antialiased">
  <!-- Should contain rendered React components but doesn't -->
</div></div>
```

## 🔄 **Interconnection Analysis**

```
Task 4 (location.assign) → Task 1 (React undefined) → Task 8 (not rendered)
Task 5 (JSON data) → Task 1 (React undefined) → Task 8 (not rendered)  
Task 2,6,7 (resource loading) → All other tasks
```

## 🎯 **Comprehensive Solution Strategy**

### **Phase 1: Fix Core Location.assign Issue (Root Cause)**
**Problem**: Current preload.js patch doesn't work because it runs after React tries to use location.assign

**Solution**: 
1. **Early Injection**: Patch location object BEFORE any scripts load
2. **Complete Override**: Replace both assign and replace methods
3. **Fail-Safe Fallback**: Graceful degradation if patches fail

**File Locations**:
- **Main Patch**: `apps/web/electron/preload.js:1-10` (add early injection)
- **Current Issue**: `apps/web/electron/preload.js:45-65` (too late in execution)
- **Build Patch**: `apps/web/scripts/fix-electron-paths-simple.js:95-117` (current regex replacement)
- **Error Source**: React DOM trying to access location.assign during hydration

**Implementation**:
```javascript
// apps/web/electron/preload.js:1-10 (NEW - Early injection at top of file)
// IMMEDIATE location patch - before any other code
(function() {
  'use strict';
  console.log('[ELECTRON] Applying immediate location patches...');
  
  // Store original methods
  const originalAssign = location.assign;
  const originalReplace = location.replace;
  
  // Override location.assign immediately
  Object.defineProperty(window.location, 'assign', {
    value: function(url) {
      console.log('[ELECTRON] location.assign intercepted:', url);
      try {
        window.location.href = url;
      } catch (e) {
        console.warn('[ELECTRON] location.assign fallback:', e);
      }
    },
    writable: false,
    configurable: false
  });
  
  // Also patch replace for completeness
  Object.defineProperty(window.location, 'replace', {
    value: function(url) {
      console.log('[ELECTRON] location.replace intercepted:', url);
      try {
        window.location.href = url;
      } catch (e) {
        console.warn('[ELECTRON] location.replace fallback:', e);
      }
    },
    writable: false, 
    configurable: false
  });
})();

// apps/web/scripts/fix-electron-paths-simple.js:95-117 (ENHANCE existing)
// Add more comprehensive patching
if (content.includes('location.assign') || content.includes('location.replace')) {
  console.log(`  📝 Patching location calls in ${filename}`);
  
  // Patch location.assign calls
  content = content.replace(
    /location\.assign\s*\(/g,
    '(function(url){try{window.location.href=url}catch(e){console.warn("location assign failed:",e)}})('
  );
  
  // Patch location.replace calls  
  content = content.replace(
    /location\.replace\s*\(/g,
    '(function(url){try{window.location.href=url}catch(e){console.warn("location replace failed:",e)}})('
  );
  
  patchCount++;
}
```

### **Phase 2: Fix Next.js Static Export Data Loading**
**Problem**: Next.js tries to load `.json` data files that don't exist in static export

**Solution**: 
1. **Disable getStaticProps data fetching** in static export
2. **Provide mock data** for required props  
3. **Update build configuration** to handle static-only mode

**File Locations**:
- **Config File**: `apps/web/next.config.ts:15-32` (current Electron config)
- **Missing Data**: `/C:/_next/data/electron-static-build/C:/Users/.../index.html.json` (404 error)
- **Page Source**: `apps/web/src/app/page.tsx` (may have data dependencies)
- **Error Pattern**: Next.js internal data fetching expecting JSON files

**Implementation**:
```typescript
// apps/web/next.config.ts:15-32 (ENHANCE existing config)
const nextConfig: NextConfig = isElectron ? Object.assign({}, baseConfig, {
  trailingSlash: true,
  output: 'export',
  images: { unoptimized: true },
  
  // NEW: Disable problematic data fetching for static export
  generateStaticParams: false,
  experimental: {
    missingSuspenseWithCSRBailout: false,
    // Disable runtime data loading
    esmExternals: false,
  },
  
  // NEW: Configure static export to not expect JSON data files
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Disable client-side data fetching expectations
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
  
  // NEW: Override data directory behavior
  distDir: 'out',
  assetPrefix: undefined, // Ensure relative paths
  
}) : baseConfig;

// apps/web/src/app/page.tsx (CHECK for data dependencies)
// Ensure no getStaticProps or data fetching that requires JSON files
// If found, wrap in try-catch or provide fallback data

// Example fix if page has data dependencies:
export default function HomePage({ signupCount = 0 }) {
  // Provide default values for all props
  // Remove any client-side data fetching that expects JSON files
}

// NEW: Add data fallback in layout or _app
// apps/web/src/app/layout.tsx or pages/_app.tsx
if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
  // Override Next.js data loading for Electron
  window.__NEXT_DATA__ = window.__NEXT_DATA__ || {
    props: { pageProps: { signupCount: 0 } },
    page: window.location.pathname,
    query: {},
    buildId: 'electron-static-build',
    isFallback: false
  };
}
```

### **Phase 3: Ensure Resource Loading Consistency**
**Problem**: Some resources use relative paths, others still use absolute

**Solution**:
1. **Comprehensive Path Audit**: Check ALL resource references
2. **Consistent Transform**: Apply same path fixing to ALL file types
3. **Build-Time Validation**: Verify all paths resolve correctly

**File Locations**:
- **Path Fix Script**: `apps/web/scripts/fix-electron-paths-simple.js:20-70` (current implementation)
- **HTML Files**: `apps/web/out/**/*.html` (all HTML files need fixing)
- **Font Reference**: `apps/web/out/index.html:75` (preload link)
- **Script References**: `apps/web/out/index.html:80-85` (defer scripts)
- **Static Assets**: `apps/web/out/_next/static/**/*` (all static files)

**Implementation**:
```javascript
// apps/web/scripts/fix-electron-paths-simple.js:20-70 (ENHANCE existing)

// NEW: Add comprehensive file type detection
const fileTypes = {
  html: ['.html'],
  css: ['.css'],
  js: ['.js', '.mjs'],
  json: ['.json'],
  assets: ['.woff2', '.woff', '.ttf', '.svg', '.png', '.jpg', '.jpeg']
};

// NEW: Add validation function
function validatePaths(content, filename) {
  const issues = [];
  
  // Check for remaining absolute paths
  const absolutePathRegex = /(?:href|src|url)=["']\/((?!http)[^"']+)["']/g;
  let match;
  while ((match = absolutePathRegex.exec(content)) !== null) {
    issues.push(`Absolute path found: /${match[1]}`);
  }
  
  if (issues.length > 0) {
    console.warn(`⚠️  ${filename} has ${issues.length} path issues:`);
    issues.forEach(issue => console.warn(`  - ${issue}`));
  }
  
  return issues.length === 0;
}

// ENHANCE: More comprehensive path fixing
function fixElectronPaths(content, filename) {
  let fixedContent = content;
  let changeCount = 0;
  
  // Fix href attributes (links, stylesheets, fonts)
  fixedContent = fixedContent.replace(/href="\/([^"]+)"/g, (match, path) => {
    changeCount++;
    return `href="${path}"`;
  });
  
  // Fix src attributes (scripts, images)
  fixedContent = fixedContent.replace(/src="\/([^"]+)"/g, (match, path) => {
    changeCount++;
    return `src="${path}"`;
  });
  
  // Fix CSS url() references
  fixedContent = fixedContent.replace(/url\(["']?\/([^"')]+)["']?\)/g, (match, path) => {
    changeCount++;
    return `url("${path}")`;
  });
  
  // Fix JSON references in scripts
  fixedContent = fixedContent.replace(/["']\/(_next\/[^"']+\.json)["']/g, (match, path) => {
    changeCount++;
    return `"${path}"`;
  });
  
  if (changeCount > 0) {
    console.log(`  ✅ Fixed ${changeCount} paths in ${filename}`);
  }
  
  // Validate the fixed content
  validatePaths(fixedContent, filename);
  
  return fixedContent;
}

// NEW: Add build-time verification
function verifyResourcePaths() {
  console.log('\n🔍 Verifying all resource paths...');
  
  const outDir = path.join(__dirname, '../out');
  const allHtmlFiles = glob.sync('**/*.html', { cwd: outDir });
  
  let totalIssues = 0;
  allHtmlFiles.forEach(file => {
    const content = fs.readFileSync(path.join(outDir, file), 'utf8');
    const isValid = validatePaths(content, file);
    if (!isValid) totalIssues++;
  });
  
  if (totalIssues === 0) {
    console.log('✅ All resource paths are valid!');
  } else {
    console.error(`❌ Found issues in ${totalIssues} files`);
    process.exit(1);
  }
}
```

### **Phase 4: React Hydration Recovery** 
**Problem**: React loads but doesn't hydrate due to previous errors

**Solution**:
1. **Error Boundary**: Catch and recover from hydration failures
2. **Graceful Fallback**: Client-side rendering if hydration fails  
3. **Progressive Enhancement**: Core functionality works without full React

**File Locations**:
- **React Root**: `apps/web/out/index.html` (`#__next` div - currently empty)
- **Hydration Check**: `apps/web/electron/main-simple.js:380-410` (debug injection showing failure)
- **App Component**: `apps/web/src/app/layout.tsx` or `pages/_app.tsx` (error boundary location)
- **Fallback Handler**: `apps/web/out/index.html:17-73` (existing fallback click handler)
- **Entry Point**: `apps/web/src/pages/_app.tsx` (if using Pages Router)

**Implementation**:
```javascript
// apps/web/electron/preload.js:100-150 (NEW - Add hydration recovery)

// Add React hydration monitoring and recovery
window.__electronHydrationRecovery = function() {
  console.log('[ELECTRON] Setting up hydration recovery...');
  
  // Wait for DOM and check React hydration
  setTimeout(() => {
    const reactRoot = document.querySelector('#__next');
    const hasReactContent = reactRoot && reactRoot.children.length > 1;
    
    if (!hasReactContent) {
      console.warn('[ELECTRON] React hydration failed, attempting recovery...');
      
      // Try to manually trigger React
      if (window.React && window.ReactDOM) {
        try {
          const { createRoot } = window.ReactDOM;
          const root = createRoot(reactRoot);
          
          // Create minimal app component
          const FallbackApp = window.React.createElement('div', {
            className: 'min-h-screen bg-background px-5',
            children: [
              window.React.createElement('div', {
                key: 'header',
                className: 'text-center py-8',
                children: 'OpenCut - Electron Recovery Mode'
              }),
              window.React.createElement('div', {
                key: 'content', 
                className: 'text-center',
                children: window.React.createElement('button', {
                  className: 'bg-blue-500 text-white px-4 py-2 rounded',
                  onClick: () => window.location.href = '/projects',
                  children: 'Go to Projects'
                })
              })
            ]
          });
          
          root.render(FallbackApp);
          console.log('[ELECTRON] React recovery successful');
        } catch (e) {
          console.error('[ELECTRON] React recovery failed:', e);
        }
      }
    }
  }, 3000);
};

// Auto-start recovery if needed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.__electronHydrationRecovery);
} else {
  window.__electronHydrationRecovery();
}

// apps/web/src/app/layout.tsx (NEW - Add error boundary)
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  console.error('[REACT] Hydration error:', error);
  
  return (
    <div className="min-h-screen bg-background px-5 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
        <p className="text-muted-foreground mb-4">React hydration failed</p>
        <button 
          onClick={resetErrorBoundary}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error, errorInfo) => {
            console.error('[REACT] Error boundary caught:', error, errorInfo);
          }}
        >
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}

// apps/web/out/index.html:17-73 (ENHANCE existing fallback)
// The existing fallback handler is good, but add React detection
if (!window.React || !window.ReactDOM) {
  console.log('🚀 [FALLBACK] React not available, using static handlers');
  // Keep existing fallback logic
} else {
  console.log('🚀 [FALLBACK] React available, monitoring hydration');
  // Add hydration monitoring
}
```

## 📝 **Consolidated Implementation Plan - Files Working Together**

### **🔧 CRITICAL FILE COMBINATIONS** 
*These files modify the same targets and MUST work together:*

---

### **File Group 1: `apps/web/electron/preload.js` (COMBINED MODIFICATIONS)**
**Combines**: Phase 1 (location patch) + Phase 4 (hydration recovery)

```javascript
// =================== IMMEDIATE EXECUTION (Lines 1-40) ===================
// PHASE 1: Early location patching - MUST be first
(function() {
  'use strict';
  console.log('[ELECTRON] Applying immediate location patches...');
  
  // Override location.assign immediately - before any other scripts
  Object.defineProperty(window.location, 'assign', {
    value: function(url) {
      console.log('[ELECTRON] location.assign intercepted:', url);
      try {
        window.location.href = url;
      } catch (e) {
        console.warn('[ELECTRON] location.assign fallback:', e);
      }
    },
    writable: false,
    configurable: false
  });
  
  // Override location.replace for completeness
  Object.defineProperty(window.location, 'replace', {
    value: function(url) {
      console.log('[ELECTRON] location.replace intercepted:', url);
      try {
        window.location.href = url;
      } catch (e) {
        console.warn('[ELECTRON] location.replace fallback:', e);
      }
    },
    writable: false, 
    configurable: false
  });
})();

// =================== EXISTING PRELOAD CODE (Lines 41-99) ===================
// [Keep all existing preload.js content here]
console.log('Electron preload script loaded');
// ... existing code ...

// =================== HYDRATION RECOVERY (Lines 100-150) ===================
// PHASE 4: React hydration monitoring and recovery
window.__electronHydrationRecovery = function() {
  console.log('[ELECTRON] Setting up hydration recovery...');
  
  // Wait for DOM and check React hydration
  setTimeout(() => {
    const reactRoot = document.querySelector('#__next');
    const hasReactContent = reactRoot && reactRoot.children.length > 1;
    
    if (!hasReactContent) {
      console.warn('[ELECTRON] React hydration failed, attempting recovery...');
      
      // Try to manually trigger React if available
      if (window.React && window.ReactDOM) {
        try {
          const { createRoot } = window.ReactDOM;
          const root = createRoot(reactRoot);
          
          // Create minimal recovery app
          const FallbackApp = window.React.createElement('div', {
            className: 'min-h-screen bg-background px-5 flex items-center justify-center',
            children: [
              window.React.createElement('div', {
                key: 'content',
                className: 'text-center',
                children: [
                  window.React.createElement('h1', {
                    key: 'title',
                    className: 'text-2xl font-bold mb-4',
                    children: 'OpenCut - Recovery Mode'
                  }),
                  window.React.createElement('button', {
                    key: 'projects-btn',
                    className: 'bg-blue-500 text-white px-4 py-2 rounded mr-2',
                    onClick: () => window.location.href = '/projects',
                    children: 'Projects'
                  }),
                  window.React.createElement('button', {
                    key: 'home-btn', 
                    className: 'bg-gray-500 text-white px-4 py-2 rounded',
                    onClick: () => window.location.href = '/',
                    children: 'Home'
                  })
                ]
              })
            ]
          });
          
          root.render(FallbackApp);
          console.log('[ELECTRON] React recovery successful');
        } catch (e) {
          console.error('[ELECTRON] React recovery failed:', e);
        }
      }
    } else {
      console.log('[ELECTRON] React hydration successful');
    }
  }, 3000);
};

// Auto-start recovery monitoring
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.__electronHydrationRecovery);
} else {
  window.__electronHydrationRecovery();
}
```

---

### **File Group 2: `apps/web/scripts/fix-electron-paths-simple.js` (COMBINED MODIFICATIONS)**
**Combines**: Phase 1 (build patches) + Phase 3 (path consistency)

```javascript
// =================== ENHANCED PATH FIXING (Lines 20-120) ===================
// PHASE 3: Comprehensive file type detection
const fileTypes = {
  html: ['.html'],
  css: ['.css'],
  js: ['.js', '.mjs'],
  json: ['.json'],
  assets: ['.woff2', '.woff', '.ttf', '.svg', '.png', '.jpg', '.jpeg']
};

// PHASE 3: Validation function
function validatePaths(content, filename) {
  const issues = [];
  const absolutePathRegex = /(?:href|src|url)=["']\/((?!http)[^"']+)["']/g;
  let match;
  while ((match = absolutePathRegex.exec(content)) !== null) {
    issues.push(`Absolute path found: /${match[1]}`);
  }
  
  if (issues.length > 0) {
    console.warn(`⚠️  ${filename} has ${issues.length} path issues:`);
    issues.forEach(issue => console.warn(`  - ${issue}`));
  }
  
  return issues.length === 0;
}

// COMBINED: Enhanced path fixing + location patching
function fixElectronPaths(content, filename) {
  let fixedContent = content;
  let changeCount = 0;
  
  // PHASE 3: Fix href attributes (links, stylesheets, fonts)
  fixedContent = fixedContent.replace(/href="\/([^"]+)"/g, (match, path) => {
    changeCount++;
    return `href="${path}"`;
  });
  
  // PHASE 3: Fix src attributes (scripts, images)
  fixedContent = fixedContent.replace(/src="\/([^"]+)"/g, (match, path) => {
    changeCount++;
    return `src="${path}"`;
  });
  
  // PHASE 3: Fix CSS url() references
  fixedContent = fixedContent.replace(/url\(["']?\/([^"')]+)["']?\)/g, (match, path) => {
    changeCount++;
    return `url("${path}")`;
  });
  
  // PHASE 1: Enhanced location patching for JS files
  if (filename.endsWith('.js')) {
    if (fixedContent.includes('location.assign') || fixedContent.includes('location.replace')) {
      console.log(`  📝 Patching location calls in ${filename}`);
      
      // Patch location.assign calls
      fixedContent = fixedContent.replace(
        /location\.assign\s*\(/g,
        '(function(url){try{window.location.href=url}catch(e){console.warn("location assign failed:",e)}})('
      );
      
      // Patch location.replace calls  
      fixedContent = fixedContent.replace(
        /location\.replace\s*\(/g,
        '(function(url){try{window.location.href=url}catch(e){console.warn("location replace failed:",e)}})('
      );
      
      changeCount++;
    }
  }
  
  if (changeCount > 0) {
    console.log(`  ✅ Fixed ${changeCount} paths in ${filename}`);
  }
  
  // PHASE 3: Validate the fixed content
  validatePaths(fixedContent, filename);
  
  return fixedContent;
}

// PHASE 3: Build-time verification
function verifyResourcePaths() {
  console.log('\n🔍 Verifying all resource paths...');
  
  const outDir = path.join(__dirname, '../out');
  const allHtmlFiles = glob.sync('**/*.html', { cwd: outDir });
  
  let totalIssues = 0;
  allHtmlFiles.forEach(file => {
    const content = fs.readFileSync(path.join(outDir, file), 'utf8');
    const isValid = validatePaths(content, file);
    if (!isValid) totalIssues++;
  });
  
  if (totalIssues === 0) {
    console.log('✅ All resource paths are valid!');
  } else {
    console.error(`❌ Found issues in ${totalIssues} files`);
  }
}

// Add verification call at end of script
module.exports = { fixElectronPaths, verifyResourcePaths };
```

---

### **File Group 3: `apps/web/next.config.ts` (STANDALONE)**
**Phase 2**: Next.js data loading fix

```typescript
// PHASE 2: Enhanced Electron configuration (Lines 15-50)
const nextConfig: NextConfig = isElectron ? Object.assign({}, baseConfig, {
  trailingSlash: true,
  output: 'export',
  images: { unoptimized: true },
  
  // PHASE 2: Disable problematic data fetching for static export
  generateStaticParams: false,
  experimental: {
    missingSuspenseWithCSRBailout: false,
    esmExternals: false, // Disable runtime data loading
  },
  
  // PHASE 2: Configure static export to not expect JSON data files
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Disable client-side data fetching expectations
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
  
  // PHASE 2: Override data directory behavior
  distDir: 'out',
  assetPrefix: undefined, // Ensure relative paths
  
}) : baseConfig;
```

---

### **File Group 4: `apps/web/src/app/layout.tsx` (STANDALONE)**
**Phase 4**: Error boundary for React recovery

```tsx
// PHASE 4: Error boundary implementation
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  console.error('[REACT] Hydration error:', error);
  
  return (
    <div className="min-h-screen bg-background px-5 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">React Error Detected</h2>
        <p className="text-muted-foreground mb-4">Hydration failed - switching to recovery mode</p>
        <div className="space-x-2">
          <button 
            onClick={resetErrorBoundary}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Retry React
          </button>
          <button 
            onClick={() => window.location.href = '/projects'}
            className="bg-gray-500 text-white px-4 py-2 rounded"
          >
            Go to Projects
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error, errorInfo) => {
            console.error('[REACT] Error boundary caught:', error, errorInfo);
          }}
          onReset={() => {
            // Clear any error state and retry
            window.location.reload();
          }}
        >
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

---

## **🚀 EXECUTION ORDER - All Files Working Together**

### **Step 1: Update Preload Script (5 min)**
```bash
# Edit apps/web/electron/preload.js
# - Add immediate location patching at top (Phase 1)
# - Add hydration recovery at bottom (Phase 4)
# - Keep all existing code in middle
```

### **Step 2: Update Build Script (5 min)**
```bash
# Edit apps/web/scripts/fix-electron-paths-simple.js
# - Add comprehensive path fixing (Phase 3)
# - Add enhanced location patching for JS files (Phase 1)
# - Add validation and verification
```

### **Step 3: Update Next.js Config (3 min)**
```bash
# Edit apps/web/next.config.ts
# - Add data fetching disabling (Phase 2)
# - Add webpack configuration
```

### **Step 4: Add Error Boundary (3 min)**
```bash
# Edit apps/web/src/app/layout.tsx
# - Add ErrorBoundary wrapper (Phase 4)
# - Add fallback component
```

### **Step 5: Build & Test Everything (10 min)**
```bash
bun run export:electron
node apps/web/scripts/fix-electron-paths-simple.js
npx electron apps/web/electron/main-simple.js
```

### **✅ SUCCESS VALIDATION**
1. No location.assign errors (Phase 1 ✅)
2. No JSON data 404s (Phase 2 ✅) 
3. No resource 404s (Phase 3 ✅)
4. React renders or recovery works (Phase 4 ✅)
5. All 8 original issues resolved ✅

## ✅ **Success Criteria - Interconnected Solutions**

**All 8 issues resolved with NO regressions:**

1. ✅ `window.React`, `window.ReactDOM`, `window.next` all defined
   - **Fixed by**: Preload location patch + build script patching
2. ✅ All fonts load without 404 errors  
   - **Fixed by**: Build script path transformation
3. ✅ Security warnings minimized (acceptable for dev)
   - **Status**: Cosmetic only, no fix needed
4. ✅ No location.assign read-only errors
   - **Fixed by**: Preload immediate patching + build-time JS patching
5. ✅ No missing JSON data file errors
   - **Fixed by**: Next.js config data fetching disable
6. ✅ All script files load successfully
   - **Fixed by**: Build script path transformation
7. ✅ No script loading cascade failures
   - **Fixed by**: Script path fixes preventing cascading errors
8. ✅ React renders properly with `#__next` content visible
   - **Fixed by**: Error boundary + hydration recovery system

**🔄 Interconnection Verification:**
- Location.assign fix enables React → Fixes hydration
- Path fixing enables resource loading → Enables React loading
- Data loading fix prevents hydration blocking → Enables React
- Error boundary catches any remaining issues → Provides fallback

**Final Result**: Fully functional Electron app with zero console errors

## 🚨 **Risk Mitigation**

### **Backup Strategy**:
- Test each change incrementally
- Keep working backup of current state
- Implement fallbacks for each critical component

### **Validation Approach**:
- Run full Electron test after each phase
- Verify all previous fixes still work
- Document any new issues immediately

---

**Goal**: Make Electron app fully functional with zero console errors and complete React hydration.
**Timeline**: ~26 minutes with combined file approach (reduced from 35 min)
**Priority**: Combined modifications ensure all interdependent fixes work together without conflicts

**🎯 KEY INSIGHT**: By combining file modifications, we eliminate the risk of:
- One fix breaking another
- Race conditions between patches
- Inconsistent implementations across related fixes
- Regression issues when applying sequential changes