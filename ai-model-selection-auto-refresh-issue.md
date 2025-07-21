# AI Model Selection Auto-Refresh Issue

## Problem Description
When user navigates to AI tab → switches to "Image to Video" tab → tries to select an AI model from the dropdown, the interface auto-refreshes and resets, preventing model selection.

## User Flow That Triggers Issue
1. User clicks **AI** tab in media panel
2. User switches from "Text to Video" to **"Image to Video"** tab
3. User uploads an image (visible in screenshot: jpg 0.1 MB)
4. User clicks on **"AI Model"** dropdown (shows "Select AI model")
5. **BUG**: Interface auto-refreshes/resets instead of showing model options

## Visual Evidence
- Screenshot shows AI Video Generation panel with Image to Video tab active
- Image uploaded successfully (jpg 0.1 MB)
- "Select AI model" dropdown is visible but clicking it causes refresh
- Console shows multiple CSS errors and JavaScript issues

## Relevant Files and Code

### 1. AI View Component  
**File**: `apps/web/src/components/editor/media-panel/views/ai.tsx:45-799`

**Key State Management (CURRENT IMPLEMENTATION)**:
```tsx
// Line 60: Uses global AI tab state instead of local state
const { aiActiveTab: activeTab, setAiActiveTab: setActiveTab } = useMediaPanelStore();

// Lines 46-57: Component state
const [selectedModel, setSelectedModel] = useState<string>("");
const [selectedImage, setSelectedImage] = useState<File | null>(null);
const [imagePreview, setImagePreview] = useState<string | null>(null);

// Line 63: Project store for debugging
const { activeProject } = useProjectStore();
```

**AI Model Definitions (Lines 26-33)**:
```tsx
const AI_MODELS: AIModel[] = [
  { id: "veo3", name: "Veo3", description: "Highest quality, slower generation", price: "$3.00", resolution: "1080p" },
  { id: "veo3_fast", name: "Veo3 Fast", description: "High quality, faster generation", price: "$2.00", resolution: "1080p" },
  { id: "veo2", name: "Veo2", description: "Good quality, balanced speed", price: "$2.50", resolution: "1080p" },
  { id: "hailuo", name: "Hailuo", description: "Fast generation, good quality", price: "$0.08", resolution: "720p" },
  { id: "kling", name: "Kling v1.5", description: "Fast generation, cost-effective", price: "$0.10", resolution: "720p" },
  { id: "kling_v2", name: "Kling v2.1", description: "Premium model with unparalleled motion fluidity", price: "$0.15", resolution: "1080p" },
];
```

**Debug Logging (Lines 69-78)**:
```tsx
// DEBUG: Component lifecycle tracking
debugLogger.log('AIView', 'RENDER', {
  activeTab,
  selectedModel,
  selectedImageExists: !!selectedImage,
  currentProjectId: activeProject?.id,
  isFallbackProject,
  currentUrl: window.location.href,
  renderCount: Math.random()
});
```

### 2. Model Selection Dropdown Implementation
**File**: `apps/web/src/components/editor/media-panel/views/ai.tsx:524-619`

**ACTUAL CURRENT IMPLEMENTATION**:
```tsx
{/* Model Selection - Lines 524-619 */}
<div className="space-y-2">
  <Label htmlFor="model">AI Model</Label>
  <Select 
    key={`model-select-${activeTab}`}
    value={selectedModel}
    onValueChange={(value) => {
      debugLogger.log('AIView', 'MODEL_SELECTION_START', { 
        selectedModel: value, 
        previousModel: selectedModel,
        activeTab,
        currentProjectId: activeProject?.id,
        currentUrl: window.location.href
      });
      
      // Prevent any default behaviors
      if (window.event) {
        window.event.preventDefault?.();
        window.event.stopPropagation?.();
      }
      
      setSelectedModel(value);
      debugLogger.log('AIView', 'MODEL_SELECTION_COMPLETE', { 
        newModel: value,
        currentProjectId: activeProject?.id 
      });
    }}
    onOpenChange={(open) => {
      debugLogger.log('AIView', 'MODEL_DROPDOWN_TOGGLE', { 
        isOpen: open, 
        activeTab, 
        selectedModel,
        currentProjectId: activeProject?.id
      });
    }}
  >
    <SelectTrigger 
      id="model" 
      onClick={(e) => {
        e.stopPropagation();
        debugLogger.log('AIView', 'MODEL_TRIGGER_CLICK', { 
          activeTab, 
          selectedModel,
          currentProjectId: activeProject?.id
        });
      }}
    >
      <SelectValue placeholder="Select AI model" />
    </SelectTrigger>
    <SelectContent>
      {AI_MODELS.map((model) => (
        <SelectItem 
          key={model.id} 
          value={model.id}
          onClick={(e) => {
            e.stopPropagation();
            console.log('🎲 MODEL_ITEM_CLICK:', { 
              modelId: model.id, 
              modelName: model.name,
              timestamp: Date.now() 
            });
          }}
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium">{model.name}</span>
              <span className="text-xs text-muted-foreground">
                {model.price} • {model.resolution}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {model.description}
            </span>
          </div>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

### 3. Tabs Component
**File**: `apps/web/src/components/ui/tabs.tsx` (shadcn/ui component)

**Potential Issues**:
- Tab state management conflicts
- TabsContent rendering issues
- Event propagation problems

### 4. Select Component  
**File**: `apps/web/src/components/ui/select.tsx` (shadcn/ui component)

**Potential Issues**:
- Select dropdown portal rendering
- onValueChange event handling
- SelectContent z-index or positioning

### 5. Media Panel Store
**File**: `apps/web/src/components/editor/media-panel/store.ts:71-84`

**CURRENT IMPLEMENTATION (Fixed)**:
```tsx
interface MediaPanelStore {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  // AI-specific tab state (separate from main tabs)
  aiActiveTab: "text" | "image";
  setAiActiveTab: (tab: "text" | "image") => void;
}

export const useMediaPanelStore = create<MediaPanelStore>((set) => ({
  activeTab: "media",
  setActiveTab: (tab) => set({ activeTab: tab }),
  aiActiveTab: "text",
  setAiActiveTab: (tab) => set({ aiActiveTab: tab }),
}));
```

**Tab Definitions (Lines 16-27)**:
```tsx
export type Tab =
  | "media" | "audio" | "text" | "stickers" | "effects"
  | "transitions" | "captions" | "filters" | "adjustment" | "ai";
```

## Potential Root Causes

### 1. State Management Conflicts
- **Double state management**: Both local `activeTab` state and media panel store state
- **State reset on re-render**: Model selection triggers component re-render that resets state
- **Tab state conflicts**: Multiple tab components managing state independently

### 2. Event Handling Issues
- **Event bubbling**: Select dropdown click bubbling to parent elements
- **Form submission**: Dropdown selection triggering unwanted form actions
- **Tab change side effects**: Model selection accidentally triggering tab changes

### 3. Component Re-mounting
- **Key prop issues**: Missing or changing keys causing component re-mounts
- **Conditional rendering**: Tab switching causing component unmount/remount
- **Effect loops**: useEffect dependencies causing infinite re-renders

### 4. Portal/Z-index Issues
- **Select portal**: Dropdown content rendering outside viewport
- **Z-index conflicts**: Dropdown appearing behind other elements
- **Event capture**: Click events not reaching dropdown options

## ✅ DEBUGGING IMPLEMENTATION COMPLETED

### **Source Code Analysis Results**

#### **Current Architecture Found**:
```tsx
// File: apps/web/src/components/editor/media-panel/views/ai.tsx
export function AiView() {
  // LOCAL state management (potential conflict source)
  const [activeTab, setActiveTab] = useState<"text" | "image">("text");
  const [selectedModel, setSelectedModel] = useState<string>("");
  
  // Component renders with Tabs + Select components
  <Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsContent value="image">
      <Select value={selectedModel} onValueChange={setSelectedModel}>
```

#### **Potential Conflict Identified**:
- **MediaPanel** uses `useMediaPanelStore()` for global tab state
- **AiView** uses local `useState` for internal tab state  
- **Two different state systems** managing tabs simultaneously

### **Comprehensive Debugging Added**

#### **1. Component Lifecycle Tracking** ✅
```tsx
// Added to AiView component
console.log('🤖 AI_VIEW_RENDER:', {
  activeTab,
  selectedModel,
  selectedImageExists: !!selectedImage,
  timestamp: Date.now(),
  renderCount: Math.random()
});
```

#### **2. Tab Change Monitoring** ✅
```tsx
// Added to Tabs onValueChange
onValueChange={(value) => {
  console.log('🔄 TAB_CHANGE:', { from: activeTab, to: value, timestamp: Date.now() });
  setActiveTab(value as "text" | "image");
}}
```

#### **3. Model Selection Full Event Chain** ✅
```tsx
// Added comprehensive Select debugging
<Select 
  onValueChange={(value) => {
    console.log('🎯 MODEL_SELECTION:', { 
      selectedModel: value, 
      previousModel: selectedModel,
      activeTab,
      timestamp: Date.now() 
    });
    setSelectedModel(value);
  }}
  onOpenChange={(open) => {
    console.log('📋 MODEL_DROPDOWN:', { 
      isOpen: open, 
      activeTab, 
      selectedModel,
      timestamp: Date.now() 
    });
  }}
>
  <SelectTrigger onClick={() => {
    console.log('🖱️ MODEL_TRIGGER_CLICK:', { 
      activeTab, 
      selectedModel,
      timestamp: Date.now() 
    });
  }}>
```

#### **4. Parent Panel State Tracking** ✅
```tsx
// Added to MediaPanel index.tsx
console.log('📱 MEDIA_PANEL_RENDER:', { 
  activeTab, 
  timestamp: Date.now(),
  aiViewWillRender: activeTab === 'ai'
});
```

### **How to Debug the Issue**

#### **Step 1: Open Browser Console**
- Press `F12` → Console tab
- Look for debug messages with emojis (🤖, 🔄, 🎯, 📋, 🖱️, 📱)

#### **Step 2: Reproduce the Issue**
1. Click AI tab
2. Switch to "Image to Video"  
3. Upload image
4. Click "Select AI model" dropdown
5. **Watch console logs** during the auto-refresh

#### **Step 3: Analyze Log Pattern**
Look for this sequence:
```
📱 MEDIA_PANEL_RENDER: { activeTab: 'ai' }
🤖 AI_VIEW_RENDER: { activeTab: 'image' }
🔄 TAB_CHANGE: { from: 'text', to: 'image' }
🖱️ MODEL_TRIGGER_CLICK: { activeTab: 'image' }
📋 MODEL_DROPDOWN: { isOpen: true }
// ❌ IF AUTO-REFRESH HAPPENS HERE, LOGS WILL RESTART
```

#### **Step 4: Identify Root Cause**
- **If logs show continuous re-renders**: Component unmount/remount issue
- **If logs show state resets**: State management conflict  
- **If logs show tab changes**: Unwanted tab switching
- **If logs stop abruptly**: Error/exception causing refresh

## Potential Solutions

### Solution 1: Fix State Management
```tsx
// Remove local activeTab state, use only media panel store
const { activeTab, setActiveTab } = useMediaPanelStore();
// Remove: const [activeTab, setActiveTab] = useState<"text" | "image">("text");
```

### Solution 2: Event Prevention
```tsx
<Select 
  value={selectedModel} 
  onValueChange={(value) => {
    console.log('Model selected:', value);
    setSelectedModel(value);
  }}
  onOpenChange={(open) => {
    if (open) {
      // Prevent any parent event handling
      document.addEventListener('click', (e) => e.stopPropagation(), { once: true });
    }
  }}
>
```

### Solution 3: Stable Keys
```tsx
// Ensure stable component keys
<TabsContent key={`image-tab-${activeTab}`} value="image" className="space-y-4">
```

### Solution 4: Error Boundary
```tsx
// Wrap AI component in error boundary to catch and handle refresh triggers
<ErrorBoundary fallback={<div>AI panel error</div>}>
  <AiView />
</ErrorBoundary>
```

### 6. Editor Page Navigation Logic
**File**: `apps/web/src/pages/editor/project/[project_id].tsx:121-221`

**Fallback Project Detection (Lines 148-180)**:
```tsx
// Check if this is a fallback project ID only once
if (!fallbackCheckDone.current) {
  const isFallbackProjectId = projectId.startsWith('project-') && 
    (/^project-\d{13}$/.test(projectId) || projectId === 'project-1753087892498');
  
  debugLogger.log('EditorPage', 'FALLBACK_DETECTION', {
    projectId,
    startsWithProject: projectId.startsWith('project-'),
    regexTest: /^project-\d{13}$/.test(projectId),
    isFallbackProjectId,
    projectIdLength: projectId.length,
    fallbackCheckAlreadyDone: fallbackCheckDone.current
  });
  
  fallbackCheckDone.current = true;
  
  if (isFallbackProjectId) {
    debugLogger.log('EditorPage', 'FALLBACK_PROJECT_DETECTED', { 
      projectId,
      redirectAction: 'projects'
    });
    
    // Clean up any fallback project data from localStorage
    localStorage.removeItem('opencut-fallback-project');
    
    debugLogger.log('EditorPage', 'NAVIGATING_TO_PROJECTS', { 
      reason: 'fallback_project',
      projectId 
    });
    
    setTimeout(() => router.replace('/projects'), 100);
    return;
  }
}
```

**Navigation Timing Fix (Lines 198-199, 215-216)**:
```tsx
// Use setTimeout to prevent mid-render navigation that could cause AI component re-mount
setTimeout(() => router.replace(`/editor/project/${newProjectId}`), 100);
```

## Files to Investigate

1. **Primary**: `apps/web/src/components/editor/media-panel/views/ai.tsx:45-799`
2. **Store**: `apps/web/src/components/editor/media-panel/store.ts:71-84` 
3. **Navigation**: `apps/web/src/pages/editor/project/[project_id].tsx:121-221`
4. **Debug Logger**: `apps/web/src/lib/debug-logger.ts` (NEW - persistent logging)
5. **UI Components**: `apps/web/src/components/ui/select.tsx`, `apps/web/src/components/ui/tabs.tsx`

## ✅ SOLUTION IMPLEMENTED

### **Root Cause Identified and Fixed**
1. ✅ **Console debugging implemented** - Full event chain tracking added
2. ✅ **State conflict identified** - Local vs global tab state management
3. ✅ **Select component debugging** - Complete event lifecycle logging
4. ✅ **Tab switching monitoring** - State change tracking added
5. ✅ **State management fixed** - Removed duplicate state causing re-renders
6. ✅ **Project loading error handling** - Fixed router.replace causing component re-mounts

### **Debug Testing Protocol**
1. **Open browser console** (`F12`)
2. **Reproduce the exact user flow**:
   - AI tab → Image to Video → Upload image → Click model dropdown
3. **Monitor console for emoji-tagged logs** (🤖🔄🎯📋🖱️📱)
4. **Identify exactly when auto-refresh occurs** in the log sequence
5. **Report findings** based on log pattern analysis

### **Expected Debug Outcomes**
- **Pattern A**: Continuous re-renders → Component lifecycle issue
- **Pattern B**: State resets → State management conflict
- **Pattern C**: Unexpected tab changes → Event propagation issue  
- **Pattern D**: Abrupt log stoppage → JavaScript error/exception

### **Files Modified for Solution**
- ✅ `apps/web/src/components/editor/media-panel/store.ts` (added aiActiveTab state)
- ✅ `apps/web/src/components/editor/media-panel/views/ai.tsx` (removed local state, added debugging, event prevention)
- ✅ `apps/web/src/components/editor/media-panel/index.tsx` (parent state tracking)

### **Key Changes Made**
1. **Added AI-specific tab state to global store**:
   ```tsx
   // In store.ts
   aiActiveTab: "text" | "image";
   setAiActiveTab: (tab: "text" | "image") => void;
   ```

2. **Removed local activeTab state from AI component**:
   ```tsx
   // REMOVED: const [activeTab, setActiveTab] = useState<"text" | "image">("text");
   // ADDED: const { aiActiveTab: activeTab, setAiActiveTab: setActiveTab } = useMediaPanelStore();
   ```

3. **Added stable component keys**:
   ```tsx
   <Select key={`model-select-${activeTab}`} />
   <TabsContent key="text-tab-content" value="text" />
   <TabsContent key="image-tab-content" value="image" />
   ```

4. **Prevented event propagation**:
   ```tsx
   onClick={(e) => { e.stopPropagation(); ... }}
   ```

5. **Fixed project loading navigation timing**:
   ```tsx
   // BEFORE: router.replace() called immediately during error handling
   // AFTER: setTimeout(() => router.replace(...), 100) to prevent mid-render navigation
   ```

## 🔄 **LATEST UPDATE - PERSISTENT ISSUE (FILE LOGGING ADDED)**

### **New Symptoms**
- After multiple fixes, AI model selection STILL causes navigation back to projects page
- Issue persists despite:
  - State management fixes
  - Navigation timing fixes  
  - Fallback detection improvements
  - useEffect dependency fixes
- User reports: "I do not what happen it goes back to new project after I select AI model why?"

### **NEW: Comprehensive File Logging Added**
- Created `apps/web/src/lib/debug-logger.ts` - persistent logging to localStorage
- Added detailed logging to both AI component and Editor page
- Logs are exportable and survive page navigation
- Access logs via: `window.debugLogger.exportLogs()` in browser console

### **Latest Debugging Added**
1. **Enhanced model selection logging** - Added currentProjectId and currentUrl to debug output
2. **Refined fallback detection** - Changed from broad `project-` detection to specific timestamp pattern `/^project-\d{13}$/`
3. **Navigation monitoring** - Added beforeunload listener to detect when navigation occurs
4. **Component render tracking** - Enhanced AI_VIEW_RENDER logs with project context

### **Hypothesis**
- Previous fallback detection was too broad, catching legitimate projects
- There may be another navigation trigger we haven't identified
- Project store state changes might be causing re-navigation

### **NEW TESTING PROTOCOL - File Logging**

#### **Immediate Steps**
1. **Clear existing logs**: Open browser console → `window.debugLogger.clearLogs()`
2. **Reproduce the issue**: Navigate to AI → Image to Video → Select model 
3. **Export logs**: In console → `window.debugLogger.exportLogs()`
4. **Analyze the sequence** of events in the exported log file

#### **Key Events to Look For**
- `AIView - RENDER` - Component render cycles
- `AIView - MODEL_SELECTION_START` - When dropdown selection begins
- `AIView - MODEL_SELECTION_COMPLETE` - When selection finishes
- `AIView - NAVIGATION_DETECTED` - If navigation is triggered
- `EditorPage - FALLBACK_DETECTION` - If fallback logic runs
- `EditorPage - NAVIGATING_TO_PROJECTS` - If redirect happens

#### **Analysis Questions**
1. Does `MODEL_SELECTION_START` complete without `MODEL_SELECTION_COMPLETE`?
2. Is `FALLBACK_DETECTION` running after model selection?
3. What's the time gap between model selection and navigation?
4. Is the current project ID changing during selection?

### **Files Modified for Logging**
- ✅ `apps/web/src/lib/debug-logger.ts:1-50+` (new file - persistent logging system)
- ✅ `apps/web/src/components/editor/media-panel/views/ai.tsx:69-78,530-575` (comprehensive AI event logging)
- ✅ `apps/web/src/pages/editor/project/[project_id].tsx:122-128,383-390,403-406` (editor page navigation logging)

### **Key Debug Logger API (Lines 1-50+)**:
```tsx
// File: apps/web/src/lib/debug-logger.ts
class DebugLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private storageKey = 'opencut-debug-logs';
  
  log(component: string, event: string, data: any): void
  clearLogs(): void
  getLogs(): LogEntry[]
  exportLogs(): void  // Downloads logs as JSON file
}

// Global instance
export const debugLogger = DebugLogger.getInstance();

// Window API for browser console access
declare global {
  interface Window {
    debugLogger: DebugLogger;
  }
}
```

### **How to Use Debug Logging**
```javascript
// In browser console:
window.debugLogger.clearLogs()        // Clear previous logs
// Reproduce the issue...
window.debugLogger.exportLogs()       // Download log file
window.debugLogger.getLogs()          // View logs in console
```

---

## Success Criteria

- User can click AI Model dropdown without interface refresh
- Dropdown shows list of available AI models
- User can select a model and it persists
- No console errors during model selection
- Smooth transition from image upload to model selection
- **NEW**: No navigation back to project creation after model selection

---

## **STATUS: COMPREHENSIVE LOGGING ACTIVE**
The issue persists despite multiple fix attempts. Comprehensive file logging is now in place to track the exact sequence of events when AI model selection triggers navigation. Use the new logging protocol above to generate detailed logs for analysis.