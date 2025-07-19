const { contextBridge, ipcRenderer } = require('electron');

// === SIMPLE PRELOAD: Minimal blocking for Electron static export ===
console.log('🚀 [ELECTRON] Simplified preload script loading...');

// PHASE 1: Apply minimal patches for Electron compatibility
try {
  // Only block file:// protocol JSON requests that cause errors
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || input.toString();
    
    // Only block problematic file:// JSON requests
    if (url && url.startsWith('file://') && url.includes('.json')) {
      console.log('🚫 [ELECTRON] Blocking file:// JSON request:', url);
      return Promise.reject(new Error('File protocol JSON requests not supported'));
    }
    
    return originalFetch.apply(this, arguments);
  };
  
  console.log('✅ [ELECTRON] Minimal fetch patching applied');
} catch (e) {
  console.warn('⚠️ [ELECTRON] Could not apply fetch patch:', e);
}

// PHASE 2: Set up IPC for Electron communication
contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  exportVideo: (data) => ipcRenderer.invoke('export-video', data),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  getProjectsDirectory: () => ipcRenderer.invoke('get-projects-directory'),
  getUserPreferences: () => ipcRenderer.invoke('get-user-preferences'),
  saveUserPreferences: (preferences) => ipcRenderer.invoke('save-user-preferences', preferences),
  saveProjectData: (projectId, data) => ipcRenderer.invoke('save-project-data', projectId, data),
  loadProjectData: (projectId) => ipcRenderer.invoke('load-project-data', projectId),
});

console.log('✅ [ELECTRON] IPC bridge established');

// PHASE 3: 拦截 <a> / Link 点击，改写为 app://路径
try {
  // 路径补全函数 - 修复导航到正确的 HTML 文件
  const fixElectronPath = (url) => {
    if (!url || url.startsWith('http') || url.startsWith('app://')) {
      return url;
    }
    
    // 获取当前目录的基础路径
    const currentDir = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    
    // 处理绝对路径 /projects -> projects.html
    if (url.startsWith('/')) {
      const cleanPath = url.substring(1);
      return cleanPath ? `${currentDir}/${cleanPath}.html` : window.location.href;
    }
    
    // 处理相对路径 ./projects -> projects.html
    if (url.startsWith('./')) {
      const cleanPath = url.substring(2);
      return cleanPath ? `${currentDir}/${cleanPath}.html` : window.location.href;
    }
    
    // 处理直接路径 projects -> projects.html
    if (!url.includes('.') && !url.includes('/')) {
      return `${currentDir}/${url}.html`;
    }
    
    return url;
  };

  // Create navigation handler with path completion
  const handleNavigation = (url) => {
    console.log('🔄 [ELECTRON] Navigation requested to:', url);
    const fixedUrl = fixElectronPath(url);
    console.log('🔄 [ELECTRON] Fixed navigation URL:', fixedUrl);
    window.location.href = fixedUrl;
  };
  
  // 对 location.assign/replace 做同样的路径补全
  const originalAssign = window.location.assign;
  const originalReplace = window.location.replace;
  
  window.location.assign = function(url) {
    const fixedUrl = fixElectronPath(url);
    console.log('🔄 [ELECTRON] location.assign:', url, '→', fixedUrl);
    return originalAssign.call(this, fixedUrl);
  };
  
  window.location.replace = function(url) {
    const fixedUrl = fixElectronPath(url);
    console.log('🔄 [ELECTRON] location.replace:', url, '→', fixedUrl);
    return originalReplace.call(this, fixedUrl);
  };
  
  // 注意：history API 重载已移至 NAV-FIX 脚本中，避免冲突
  console.log('🔄 [ELECTRON] History API handling delegated to NAV-FIX script');
  
  console.log('✅ [ELECTRON] Navigation and history patches applied');
} catch (e) {
  console.warn('⚠️ [ELECTRON] Could not apply navigation patches:', e);
}

// PHASE 4: 加载导航修复脚本
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔗 [ELECTRON] Loading navigation fix script...');
  
  // 加载导航修复脚本
  const script = document.createElement('script');
  script.src = './electron/navigation-fix.js';
  script.onload = () => {
    console.log('✅ [ELECTRON] Navigation fix script loaded');
  };
  script.onerror = () => {
    console.warn('⚠️ [ELECTRON] Failed to load navigation fix script');
    // 如果加载失败，使用内联修复
    setupInlineNavigationFix();
  };
  document.head.appendChild(script);
});

// 内联导航修复作为备用方案
function setupInlineNavigationFix() {
  console.log('🔗 [ELECTRON] Setting up inline navigation fix...');
  
  const currentDir = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
  
  function fixPath(url) {
    if (!url || url.startsWith('http') || (url.startsWith('file://') && url.includes('.html'))) {
      return url;
    }
    
    if (url.startsWith('./')) {
      const cleanPath = url.substring(2);
      return `${currentDir}/${cleanPath}.html`;
    }
    
    if (url.startsWith('/')) {
      const cleanPath = url.substring(1);
      return `${currentDir}/${cleanPath}.html`;
    }
    
    if (!url.includes('.') && !url.includes('/')) {
      return `${currentDir}/${url}.html`;
    }
    
    return url;
  }
  
  // 拦截点击事件
  document.addEventListener('click', (event) => {
    const target = event.target.closest('a');
    if (!target) return;
    
    const href = target.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }
    
    if (href.startsWith('/') || href.startsWith('./') || (!href.includes('://') && !href.includes('.'))) {
      event.preventDefault();
      const fixedUrl = fixPath(href);
      console.log('🔗 [ELECTRON] Link click intercepted:', href, '→', fixedUrl);
      window.location.href = fixedUrl;
    }
  }, true);
  
  // 暴露修复函数
  window.fixElectronPath = fixPath;
  
  console.log('✅ [ELECTRON] Inline navigation fix ready');
}

console.log('✅ [ELECTRON] Simplified preload script ready');
console.log('📍 [ELECTRON] Current location:', window.location.href);
console.log('🎯 [ELECTRON] ElectronAPI available:', !!window.electronAPI);