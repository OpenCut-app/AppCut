import { Html, Head, Main, NextScript } from 'next/document'
import { metadata } from '../lib/metadata'

export default function Document() {
  const isElectron = process.env.NEXT_PUBLIC_ELECTRON === "true";
  
  return (
    <Html lang="en" suppressHydrationWarning={isElectron}>
      <Head>
        <meta charSet="utf-8" />
        <meta name="description" content={metadata.description as string} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="robots" content="index, follow" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="OpenCut" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta property="og:title" content="OpenCut" />
        <meta property="og:description" content="A simple but powerful video editor that gets the job done. In your browser." />
        <meta property="og:url" content="https://opencut.app/" />
        <meta property="og:site_name" content="OpenCut" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:image" content="https://opencut.app/opengraph-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="OpenCut" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:creator" content="@opencutapp" />
        <meta name="twitter:title" content="OpenCut" />
        <meta name="twitter:description" content="A simple but powerful video editor that gets the job done. In your browser." />
        <meta name="twitter:image" content="http://localhost:3000/opengraph-image.jpg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" href="/icons/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="icon" href="/icons/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/icons/favicon-96x96.png" sizes="96x96" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-icon-57x57.png" sizes="57x57" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-icon-60x60.png" sizes="60x60" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-icon-72x72.png" sizes="72x72" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-icon-76x76.png" sizes="76x76" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-icon-114x114.png" sizes="114x114" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-icon-120x120.png" sizes="120x120" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-icon-144x144.png" sizes="144x144" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-icon-152x152.png" sizes="152x152" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-icon-180x180.png" sizes="180x180" type="image/png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              console.log('🚀 [ELECTRON DEBUG] JavaScript executing in Electron');
              
              // ROOT CAUSE FIX: IMMEDIATE blocking before ANY library loads
              (function() {
                // Override fetch globally IMMEDIATELY - must be synchronous
                if (typeof window !== 'undefined' && window.fetch) {
                  const originalFetch = window.fetch;
                  window.fetch = function(input, init) {
                    const url = typeof input === 'string' ? input : (input && input.url) || input.toString();
                    
                    // DETAILED DEBUG: Log ALL fetch requests to understand the pattern
                    console.log('🔍 [FETCH DEBUG] Request intercepted:', {
                      url: url,
                      type: typeof input,
                      input: input,
                      stack: new Error().stack
                    });
                    
                    // Block ALL .json and _next/data requests completely
                    if (url && (url.includes('.json') || url.includes('_next/data') || url.includes('.html.json'))) {
                      console.error('🚫 [IMMEDIATE BLOCK] FETCH BLOCKED WITH STACK TRACE:');
                      console.error('URL:', url);
                      console.error('Called from:', new Error().stack);
                      console.error('Input object:', input);
                      console.error('=================================');
                      return Promise.reject(new Error('Data fetching completely disabled in Electron - URL: ' + url));
                    }
                    return originalFetch.apply(this, arguments);
                  };
                }
                
                // Override XMLHttpRequest immediately
                if (typeof window !== 'undefined' && window.XMLHttpRequest) {
                  const OriginalXHR = window.XMLHttpRequest;
                  window.XMLHttpRequest = function() {
                    const xhr = new OriginalXHR();
                    const originalOpen = xhr.open;
                    xhr.open = function(method, url) {
                      // DETAILED DEBUG: Log ALL XHR requests
                      console.log('🔍 [XHR DEBUG] Request intercepted:', {
                        method: method,
                        url: url,
                        stack: new Error().stack
                      });
                      
                      if (typeof url === 'string' && (url.includes('.json') || url.includes('_next/data') || url.includes('.html.json'))) {
                        console.error('🚫 [IMMEDIATE BLOCK] XHR BLOCKED WITH STACK TRACE:');
                        console.error('Method:', method, 'URL:', url);
                        console.error('Called from:', new Error().stack);
                        console.error('=================================');
                        throw new Error('Data fetching completely disabled in Electron - XHR URL: ' + url);
                      }
                      return originalOpen.apply(this, arguments);
                    };
                    return xhr;
                  };
                }
                
                // Override any resource creation that could trigger JSON requests
                if (typeof document !== 'undefined' && document.createElement) {
                  const originalCreateElement = document.createElement;
                  document.createElement = function(tagName) {
                    const element = originalCreateElement.call(this, tagName);
                    
                    if (tagName.toLowerCase() === 'script' && element.setAttribute) {
                      const originalSetAttribute = element.setAttribute;
                      element.setAttribute = function(name, value) {
                        if (name === 'src' && typeof value === 'string' && (value.includes('.json') || value.includes('_next/data'))) {
                          console.log('🚫 [IMMEDIATE BLOCK] Script creation blocked:', value);
                          return;
                        }
                        return originalSetAttribute.call(this, name, value);
                      };
                    }
                    
                    return element;
                  };
                }
                
                // COMPREHENSIVE DEBUG: Monitor ALL resource loading  
                if (typeof window !== 'undefined') {
                  // Monitor Performance API for resource loading
                  const originalPerformanceObserver = window.PerformanceObserver;
                  if (originalPerformanceObserver) {
                    try {
                      const observer = new originalPerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                          if (entry.name && (entry.name.includes('.json') || entry.name.includes('_next/data'))) {
                            console.error('🚫 [PERFORMANCE API] Detected JSON resource load attempt:');
                            console.error('Resource:', entry.name);
                            console.error('Type:', entry.entryType);
                            console.error('Entry:', entry);
                            console.error('=================================');
                          }
                        }
                      });
                      observer.observe({entryTypes: ['resource', 'navigation']});
                      console.log('✅ [DEBUG] Performance monitoring enabled for resource detection');
                    } catch (e) {
                      console.log('⚠️ [DEBUG] Performance monitoring not available:', e);
                    }
                  }
                  
                  // Monitor window errors for failed requests
                  window.addEventListener('error', function(e) {
                    if (e.target && e.target.src && (e.target.src.includes('.json') || e.target.src.includes('_next/data'))) {
                      console.error('🚫 [WINDOW ERROR] Failed resource detected:');
                      console.error('Failed resource:', e.target.src);
                      console.error('Target:', e.target);
                      console.error('Error:', e);
                      console.error('=================================');
                    }
                  });
                  
                  // ElectronAPI detection debugging
                  console.log('🔍 [ELECTRON API DEBUG] Detection status:', {
                    electronAPI: typeof window.electronAPI,
                    process: typeof window.process,
                    require: typeof window.require,
                    userAgent: navigator.userAgent,
                    isElectron: window.process && window.process.type === 'renderer'
                  });
                }
                
                console.log('✅ [IMMEDIATE BLOCK] All data fetching mechanisms blocked at script level');
              })();
              
              // Wait for DOM to be ready
              document.addEventListener('DOMContentLoaded', function() {
                console.log('🚀 [ELECTRON] DOM ready, checking for ElectronAPI');
                
                if (typeof window !== 'undefined' && window.electronAPI && document.body) {
                  document.body.setAttribute('data-electron', 'true');
                  console.log('🚀 [ELECTRON] ElectronAPI detected and data-electron set');
                  
                  // Force React hydration to complete immediately for Electron
                  if (window.__NEXT_DATA__) {
                    window.__NEXT_DATA__.isFallback = false;
                    window.__NEXT_DATA__.gsp = false;
                    window.__NEXT_DATA__.gssp = false;
                  }
                }
                
                console.log('🚀 [DEBUG] Page loaded, body data-electron:', document.body ? document.body.getAttribute('data-electron') : 'body not found');
              });
              
              // Click debug logging and fallback handler for when React doesn't load
              document.addEventListener('click', function(e) {
                console.log('🚀 [CLICK DEBUG] Click:', e.target.tagName, e.target.textContent?.slice(0, 30));
                
                // Fallback handler for New Project button when React fails to hydrate
                if (e.target.textContent && e.target.textContent.includes('New project')) {
                  console.log('🚀 [FALLBACK] New project button clicked - React fallback handler');
                  
                  // Create a simple project and navigate to editor
                  const projectId = 'project-' + Date.now();
                  const projectName = 'New Project';
                  
                  // Save basic project data to localStorage as fallback (with error handling)
                  try {
                    const project = {
                      id: projectId,
                      name: projectName,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      backgroundColor: '#000000',
                      backgroundType: 'color',
                      blurIntensity: 8,
                      thumbnail: ''
                    };
                    
                    // Check if localStorage is available
                    if (typeof Storage !== 'undefined') {
                      localStorage.setItem('opencut-fallback-project', JSON.stringify(project));
                      console.log('🚀 [FALLBACK] Project saved to localStorage:', project);
                    } else {
                      console.log('🚀 [FALLBACK] localStorage not available, using in-memory storage');
                    }
                    
                    // Navigate to editor
                    const editorUrl = '/editor/project/' + encodeURIComponent(projectId);
                    console.log('🚀 [FALLBACK] Navigating to:', editorUrl);
                    window.location.href = editorUrl;
                  } catch (error) {
                    console.error('🚀 [FALLBACK] Error creating project:', error);
                  }
                  
                  e.preventDefault();
                  e.stopPropagation();
                  return false;
                }
                
                // Handle navigation clicks for static export
                if (e.target.tagName === 'A' || e.target.closest('a')) {
                  const link = e.target.tagName === 'A' ? e.target : e.target.closest('a');
                  const href = link.getAttribute('href');
                  
                  if (href && !href.startsWith('http') && !href.startsWith('mailto:')) {
                    e.preventDefault();
                    console.log('🚀 [NAV DEBUG] Navigating to:', href);
                    window.location.href = href;
                  }
                }
              });
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}