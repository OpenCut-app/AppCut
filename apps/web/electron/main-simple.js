const { app, BrowserWindow, ipcMain, protocol, screen, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// Window state management
let windowState = {
  width: 1400,
  height: 1000,
  x: 100, // Force position on screen
  y: 100,
  isMaximized: false
};

function resetWindowState() {
  try {
    const configPath = path.join(app.getPath('userData'), 'window-state.json');
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      console.log('🗑️ Deleted problematic window state file');
    }
  } catch (error) {
    console.log('Failed to delete window state:', error);
  }
}

function saveWindowState() {
  if (!mainWindow) return;
  
  const bounds = mainWindow.getBounds();
  windowState = {
    ...bounds,
    isMaximized: mainWindow.isMaximized()
  };
  
  try {
    const configPath = path.join(app.getPath('userData'), 'window-state.json');
    fs.writeFileSync(configPath, JSON.stringify(windowState, null, 2));
  } catch (error) {
    console.log('Failed to save window state:', error);
  }
}

function loadWindowState() {
  try {
    const configPath = path.join(app.getPath('userData'), 'window-state.json');
    if (fs.existsSync(configPath)) {
      const savedState = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      windowState = { ...windowState, ...savedState };
    }
  } catch (error) {
    console.log('Failed to load window state:', error);
  }
}

function ensureWindowOnScreen(windowState) {
  // Get primary display bounds
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const { x: screenX, y: screenY } = primaryDisplay.workArea;
  
  console.log('🖥️ Screen bounds:', { screenWidth, screenHeight, screenX, screenY });
  console.log('🪟 Window state before validation:', windowState);
  
  // Ensure window is not off-screen
  if (windowState.x < screenX || windowState.x > screenX + screenWidth - 200) {
    console.log('⚠️ Window X position off-screen, resetting to center');
    windowState.x = Math.max(screenX, Math.floor((screenWidth - windowState.width) / 2));
  }
  
  if (windowState.y < screenY || windowState.y > screenY + screenHeight - 100) {
    console.log('⚠️ Window Y position off-screen, resetting to center');
    windowState.y = Math.max(screenY, Math.floor((screenHeight - windowState.height) / 2));
  }
  
  // Ensure window dimensions are reasonable
  if (windowState.width > screenWidth) {
    windowState.width = Math.floor(screenWidth * 0.9);
  }
  
  if (windowState.height > screenHeight) {
    windowState.height = Math.floor(screenHeight * 0.9);
  }
  
  console.log('✅ Window state after validation:', windowState);
  return windowState;
}

// Handle GPU issues in headless environments and fix cache errors
app.commandLine.appendSwitch('--disable-gpu');
app.commandLine.appendSwitch('--disable-software-rasterizer');
app.commandLine.appendSwitch('--no-sandbox');
app.commandLine.appendSwitch('--disable-gpu-sandbox');
app.commandLine.appendSwitch('--disable-dev-shm-usage');
app.commandLine.appendSwitch('--disk-cache-size=1');

// Set custom cache directory to avoid permission issues
try {
  const cacheDir = path.join(app.getPath('userData'), 'cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  app.commandLine.appendSwitch('--disk-cache-dir', cacheDir);
} catch (error) {
  console.log('Warning: Could not set cache directory:', error.message);
}

let mainWindow;

function createMainWindow() {
  // Check if we should reset window state (for debugging off-screen issues)
  if (process.argv.includes('--reset-window')) {
    console.log('🔄 Resetting window state due to --reset-window flag');
    resetWindowState();
  }
  
  // Load saved window state and ensure it's on screen
  loadWindowState();
  const validatedState = ensureWindowOnScreen(windowState);
  
  console.log('🚀 Creating window with state:', validatedState);
  
  mainWindow = new BrowserWindow({
    width: validatedState.width,
    height: validatedState.height,
    x: validatedState.x,
    y: validatedState.y,
    show: true, // Show immediately for debugging
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true, // contextIsolation:true
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
      webSecurity: true, // webSecurity:true，再配 CSP
      preload: path.join(__dirname, 'preload-simplified.js'), // preload:path.join(__dirname,'preload-simplified.js')
      partition: 'persist:opencut', // Enable localStorage with persistent session
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false
    }
  });

  // Simplified: No request blocking needed since paths are now relative
  console.log('✅ [MAIN PROCESS] Using relative paths - no request blocking needed');

  // Load the built Next.js app with relative paths
  const unpackedPath = path.join(__dirname, '../out/index.html');
  
  let startUrl;
  if (fs.existsSync(unpackedPath)) {
    startUrl = `file://${unpackedPath.replace(/\\/g, '/')}`;
    console.log('📦 Loading built Next.js app with relative paths');
    console.log('📁 Out directory:', path.join(__dirname, '../out'));
  } else {
    startUrl = `file://${path.join(__dirname, '../electron-app.html').replace(/\\/g, '/')}`;
    console.log('📄 Loading static HTML fallback');
  }
  
  console.log('🚀 Loading URL:', startUrl);
  
  // Remove session-level request interceptor for better performance
  // mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
  //   console.log('🔍 Session request intercepted:', details.url);
  //   callback({});
  // });
  
  // Try to load the URL
  mainWindow.loadURL(startUrl).then(() => {
    console.log('✅ loadURL promise resolved');
  }).catch(error => {
    console.error('❌ loadURL promise rejected:', error);
  });
  
  // Open DevTools for debugging (only in development)
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
  
  // Add keyboard shortcuts for DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // F12 to toggle DevTools
    if (input.key === 'F12') {
      event.preventDefault();
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
    // Ctrl+Shift+I to toggle DevTools (check for uppercase 'I' as well)
    if (input.control && input.shift && (input.key === 'I' || input.key === 'i')) {
      event.preventDefault();
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });
  
  // Add more debugging events
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('📥 Started loading content...');
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ Failed to load:', errorCode, errorDescription, validatedURL);
    console.error('❌ Error details:', {
      errorCode,
      errorDescription,
      validatedURL,
      currentURL: mainWindow.webContents.getURL()
    });
    // Show window anyway so user can see what happened
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  });
  

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Page finished loading successfully');
    // Inject a simple script to verify JavaScript is running
    mainWindow.webContents.executeJavaScript(`
      console.log('🚀 [ELECTRON INJECT] JavaScript execution test');
      console.log('🚀 [ELECTRON INJECT] Document ready state:', document.readyState);
      console.log('🚀 [ELECTRON INJECT] Body exists:', !!document.body);
      console.log('🚀 [ELECTRON INJECT] Window location:', window.location.href);
      console.log('🚀 [ELECTRON INJECT] Body innerHTML length:', document.body ? document.body.innerHTML.length : 'no body');
      console.log('🚀 [ELECTRON INJECT] Has React root:', !!document.getElementById('__next'));
      console.log('🚀 [ELECTRON INJECT] React root content:', document.getElementById('__next') ? document.getElementById('__next').innerHTML.slice(0, 200) : 'no react root');
    `).then(() => {
      console.log('✅ JavaScript injection successful');
    }).catch(err => {
      console.error('❌ JavaScript injection failed:', err);
    });
  });
  
  mainWindow.webContents.on('console', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER] ${message}`);
  });
  
  // Note: Debug script injection removed for cleaner output
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('🔧 Page finished loading successfully');
    
    // Navigation test disabled to prevent infinite refresh loops
    console.log('🔍 Process argv:', process.argv);
    if (process.argv.includes('--test-navigation')) {
      console.log('🧪 --test-navigation flag detected, but navigation test is disabled to prevent refresh loops');
      
      // Instead of injecting navigation test, just navigate once if needed
      const targetPage = process.argv.find(arg => arg === 'projects' || arg === 'editor' || arg === 'login');
      if (targetPage) {
        console.log(`📄 Navigating to ${targetPage} page as requested`);
        setTimeout(() => {
          const url = `app://${targetPage}/index.html`;
          console.log(`🔄 Loading: ${url}`);
          mainWindow.loadURL(url);
        }, 1000);
      }
    } else {
      console.log('ℹ️ No --test-navigation flag, using normal navigation');
    }
    
    // If test button is requested, inject button test script
    if (process.argv.includes('--test-button')) {
      console.log('🧪 --test-button flag detected, injecting button test script...');
      try {
        const buttonScriptPath = path.join(__dirname, 'simple-button-test.js');
        console.log('📄 Reading button script from:', buttonScriptPath);
        const buttonScript = fs.readFileSync(buttonScriptPath, 'utf8');
        console.log('📜 Button script loaded, length:', buttonScript.length);
        
        // Wait a bit before injecting to ensure page is ready
        setTimeout(() => {
          mainWindow.webContents.executeJavaScript(buttonScript).then(() => {
            console.log('✅ Button test script injected and executed');
          }).catch(err => {
            console.error('❌ Button test script execution failed:', err);
          });
        }, 2000);
      } catch (error) {
        console.error('❌ Failed to read button test script:', error);
      }
    } else {
      console.log('ℹ️ No --test-button flag, skipping button test');
    }
  });

  // Configure CSP for local file access
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob:; " +
          "style-src 'self' 'unsafe-inline' file: data: blob:; " +
          "img-src 'self' data: blob: file:; " +
          "font-src 'self' data: file:; " +
          "media-src 'self' blob: file:; " +
          "connect-src 'self' data: blob: file: https://api.github.com; " +
          "manifest-src 'self' file:; " +
          "worker-src 'self' blob: data:;"
        ]
      }
    });
  });

  mainWindow.once('ready-to-show', () => {
    console.log('✅ Electron window ready - OpenCut loaded successfully');
    
    // Restore window state
    if (windowState.isMaximized) {
      mainWindow.maximize();
    }
    
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setAlwaysOnTop(false); // Bring to front then allow normal behavior
  });

  // Fallback: Show window after 3 seconds even if ready-to-show doesn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('⚠️ Window not visible after 3s, forcing show...');
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setAlwaysOnTop(false);
    }
  }, 3000);

  // Save window state on close
  mainWindow.on('close', () => {
    saveWindowState();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Save window state on resize/move
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      saveWindowState();
    }
  });

  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized()) {
      saveWindowState();
    }
  });

  // Simplified navigation handling for static HTML files
  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log('🔄 Navigation attempt to:', url);
    
    // Allow local file navigation only, block external navigation
    if (url.startsWith('file://')) {
      console.log('✅ Allowing local file navigation to:', url);
      
      // Try to resolve route to HTML file (e.g., /projects -> projects.html)
      const filePath = url.replace('file://', '').replace(/^\/+/, '');
      if (!fs.existsSync(filePath) && !filePath.includes('out')) {
        // This might be a route, try to find the corresponding HTML file
        const routeName = path.basename(filePath);
        const htmlFile = path.join(__dirname, '../out', routeName + '.html');
        
        if (fs.existsSync(htmlFile)) {
          const htmlUrl = `file://${htmlFile.replace(/\\/g, '/')}`;
          console.log('🔄 Redirecting route to HTML file:', htmlUrl);
          event.preventDefault();
          mainWindow.loadURL(htmlUrl);
          return;
        }
      }
    } else {
      console.log('🚫 Blocking external navigation to:', url);
      event.preventDefault();
    }
  });
  
  // Add did-navigate event to track successful navigation
  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log('✅ Navigation completed to:', url);
  });
  
  // Add did-navigate-in-page for SPA navigation
  mainWindow.webContents.on('did-navigate-in-page', (event, url) => {
    console.log('📍 In-page navigation to:', url);
  });
  
  // Note: Removed all request interception to allow proper file loading
  // RSC .txt requests will show 404 errors but won't affect functionality

  // Handle new window requests (open in default browser)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log('🌐 Opening external URL in browser:', url);
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  // Test IPC and storage
  // Forward renderer console logs to main process
  mainWindow.webContents.on('console', (event, level, message, line, sourceId) => {
    const levelStr = ['verbose', 'info', 'warning', 'error'][level] || 'unknown';
    console.log(`[RENDERER ${levelStr.toUpperCase()}] ${message}`);
    if (sourceId) {
      console.log(`  Source: ${sourceId}:${line}`);
    }
  });

  // Capture JavaScript errors
  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('❌ Renderer process crashed:', { killed });
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('❌ Renderer process gone:', details);
  });

  mainWindow.webContents.once('did-finish-load', () => {
    console.log('🎯 Page loaded - Testing Electron IPC and storage...');
    mainWindow.webContents.executeJavaScript(`
      // Set up error capturing first
      window.addEventListener('error', (event) => {
        console.error('❌ JavaScript Error:', event.error);
        console.error('  Message:', event.message);
        console.error('  File:', event.filename);
        console.error('  Line:', event.lineno);
        console.error('  Column:', event.colno);
      });
      
      window.addEventListener('unhandledrejection', (event) => {
        console.error('❌ Unhandled Promise Rejection:', event.reason);
      });
      
      // Check basic React setup
      console.log('🔍 React setup check...');
      console.log('- React:', typeof React !== 'undefined' ? 'available' : 'not available');
      console.log('- ReactDOM:', typeof ReactDOM !== 'undefined' ? 'available' : 'not available');
      console.log('- Next.js:', typeof window.__NEXT_DATA__ !== 'undefined' ? 'available' : 'not available');
      
      if (window.electronAPI) {
        window.electronAPI.ping().then(result => {
          console.log('✅ IPC Test successful:', result);
        });
      } else {
        console.log('❌ Electron API not available');
      }
      
      // Test storage APIs
      console.log('🔍 Storage API availability:');
      console.log('- IndexedDB:', 'indexedDB' in window);
      console.log('- Navigator.storage:', 'storage' in navigator);
      console.log('- OPFS getDirectory:', 'storage' in navigator && 'getDirectory' in navigator.storage);
      
      // Test storage service
      setTimeout(() => {
        console.log('🔍 Storage service initialization test...');
        if (window.storageService) {
          console.log('- Storage service available');
          console.log('- IndexedDB supported:', window.storageService.isIndexedDBSupported());
          console.log('- OPFS supported:', window.storageService.isOPFSSupported());
          console.log('- Fully supported:', window.storageService.isFullySupported());
        } else {
          console.log('❌ Storage service not available');
        }
      }, 2000);
    `);
  });
}

// Using file:// protocol with relative paths - no custom protocol needed

app.whenReady().then(() => {
  console.log('✅ App ready - using file:// protocol with relative paths');
  
  // Set up application menu with DevTools option
  const template = [
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle DevTools',
          accelerator: process.platform === 'darwin' ? 'Cmd+Option+I' : 'Ctrl+Shift+I',
          click: () => {
            if (mainWindow) {
              if (mainWindow.webContents.isDevToolsOpened()) {
                mainWindow.webContents.closeDevTools();
              } else {
                mainWindow.webContents.openDevTools();
              }
            }
          }
        },
        {
          label: 'Toggle DevTools (F12)',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              if (mainWindow.webContents.isDevToolsOpened()) {
                mainWindow.webContents.closeDevTools();
              } else {
                mainWindow.webContents.openDevTools();
              }
            }
          }
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reload();
            }
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reloadIgnoringCache();
            }
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  // Register global shortcuts
  globalShortcut.register('F12', () => {
    if (mainWindow) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });
  
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // Now create the main window after protocol is registered
  createMainWindow();
});

app.on('window-all-closed', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
  app.quit();
});

app.on('will-quit', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
});

// IPC handlers
ipcMain.handle('ping', () => {
  console.log('📡 Received ping from renderer process');
  return 'pong from Electron main process';
});

// File selection handler
ipcMain.handle('select-file', async () => {
  const { dialog } = require('electron');
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] };
    }
    return { success: false, canceled: true };
  } catch (error) {
    console.error('Failed to select file:', error);
    return { success: false, error: error.message };
  }
});

// Video export handler
ipcMain.handle('export-video', async (event, data) => {
  const { dialog } = require('electron');
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'exported-video.mp4',
      filters: [
        { name: 'Video Files', extensions: ['mp4'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      // 这里可以添加实际的视频导出逻辑
      console.log('Export video to:', result.filePath, 'with data:', data);
      return { success: true, filePath: result.filePath };
    }
    return { success: false, canceled: true };
  } catch (error) {
    console.error('Failed to export video:', error);
    return { success: false, error: error.message };
  }
});

// User data and preferences
ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('get-projects-directory', () => {
  return path.join(app.getPath('documents'), 'OpenCut Projects');
});

ipcMain.handle('get-user-preferences', () => {
  try {
    const preferencesPath = path.join(app.getPath('userData'), 'preferences.json');
    if (fs.existsSync(preferencesPath)) {
      return JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
    }
    return null;
  } catch (error) {
    console.error('Failed to load user preferences:', error);
    return null;
  }
});

ipcMain.handle('save-user-preferences', (event, preferences) => {
  try {
    const preferencesPath = path.join(app.getPath('userData'), 'preferences.json');
    fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Failed to save user preferences:', error);
    return { success: false, error: error.message };
  }
});

// Project data management
ipcMain.handle('save-project-data', (event, projectId, data) => {
  try {
    const projectsDir = path.join(app.getPath('documents'), 'OpenCut Projects');
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
    }
    
    const projectPath = path.join(projectsDir, `${projectId}.json`);
    fs.writeFileSync(projectPath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Failed to save project data:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-project-data', (event, projectId) => {
  try {
    const projectPath = path.join(app.getPath('documents'), 'OpenCut Projects', `${projectId}.json`);
    if (fs.existsSync(projectPath)) {
      return JSON.parse(fs.readFileSync(projectPath, 'utf8'));
    }
    return null;
  } catch (error) {
    console.error('Failed to load project data:', error);
    return null;
  }
});

console.log('🚀 Electron app starting...');