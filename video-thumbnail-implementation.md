# Video Thumbnail Implementation Plan

## Overview
Enhance the existing video thumbnail system in OpenCut's media panel to provide richer video previews, multiple thumbnails, and improved user experience based on the solid foundation already in place.

## Current Analysis
After analyzing the existing codebase, I found that **OpenCut already has excellent video thumbnail infrastructure**:

### ✅ **Existing Strengths**
- **FFmpeg.wasm v0.12.15** integration with `generateThumbnail()` function
- **MediaItem interface** already includes `thumbnailUrl?: string`
- **Media processing pipeline** with dual approach (FFmpeg + Canvas fallback)
- **Modern UI components** using shadcn/ui with proper video thumbnail display
- **Robust error handling** and memory-optimized processing (160x120 thumbnails)
- **Multi-tier storage** (IndexedDB + OPFS) with proper cleanup

### 🎯 **Areas for Enhancement**
- **Thumbnail Quality**: Currently fixed at 160x120, single timestamp (1s)
- **User Experience**: Basic thumbnail display without advanced features
- **Performance**: No caching beyond basic object URL management
- **Advanced Features**: Missing hover previews, multiple thumbnails, scrubbing

## Solution: Enhanced Video Thumbnail System

### Enhanced Architecture Overview
```mermaid
flowchart TD
    A[Video File Upload] --> B[processMediaFiles - Existing]
    B --> C{FFmpeg Available?}
    C -->|Yes| D[FFmpeg generateThumbnail - Enhanced]
    C -->|No| E[Canvas Fallback - Enhanced]
    D --> F[Multiple Thumbnails Generated]
    E --> F
    F --> G[Thumbnail Cache - New]
    G --> H[Enhanced UI Display]
    H --> I[User Interactions]
    I --> J[Hover Scrubbing - New]
    I --> K[Quality Selection - New]
    J --> L[Dynamic Thumbnail Loading]
    K --> L
    
    style D fill:#4ade80,stroke:#22c55e
    style F fill:#60a5fa,stroke:#3b82f6
    style G fill:#fbbf24,stroke:#f59e0b
    style J fill:#f87171,stroke:#ef4444
```

## Implementation Plan

### Phase 1: Enhanced FFmpeg Thumbnail Generation (1 day)

#### 1.1 Enhance Existing FFmpeg Utilities
**File**: `apps/web/src/lib/ffmpeg-utils.ts` (modify existing)

```typescript
// Enhance existing generateThumbnail function with new options
interface EnhancedThumbnailOptions {
  timestamps?: number[]; // Multiple timestamps, default [1]
  resolution?: 'low' | 'medium' | 'high'; // 160x120, 320x240, 480x360
  quality?: number; // JPEG quality 0-1, default 0.8
  format?: 'jpeg' | 'png' | 'webp'; // Output format
  sceneDetection?: boolean; // Smart scene detection for better thumbnails
}

// Extend existing generateThumbnail function
export const generateEnhancedThumbnails = async (
  videoFile: File,
  options: EnhancedThumbnailOptions = {}
): Promise<{
  thumbnails: string[];
  metadata: {
    duration: number;
    dimensions: { width: number; height: number };
    fps: number;
    timestamps: number[];
  };
}> => {
  const ffmpeg = await getFFmpegInstance();
  
  // Use existing FFmpeg pipeline but generate multiple thumbnails
  const {
    timestamps = [1],
    resolution = 'medium',
    format = 'jpeg',
    sceneDetection = false
  } = options;
  
  // Resolution mapping
  const resolutions = {
    low: { width: 160, height: 120 },
    medium: { width: 320, height: 240 },
    high: { width: 480, height: 360 }
  };
  
  const { width, height } = resolutions[resolution];
  
  // Scene detection logic using FFmpeg scene detection
  const finalTimestamps = sceneDetection 
    ? await detectSceneChanges(ffmpeg, videoFile, timestamps.length)
    : timestamps;
  
  // Generate multiple thumbnails in one FFmpeg pass for efficiency
  const thumbnails: string[] = [];
  
  for (const timestamp of finalTimestamps) {
    await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
    
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-ss', timestamp.toString(),
      '-vframes', '1',
      '-vf', `scale=${width}:${height}`,
      '-q:v', '2', // High quality
      '-f', format,
      `thumb_${timestamp}.${format}`
    ]);
    
    const thumbData = await ffmpeg.readFile(`thumb_${timestamp}.${format}`);
    const blob = new Blob([thumbData], { type: `image/${format}` });
    thumbnails.push(URL.createObjectURL(blob));
  }
  
  return {
    thumbnails,
    metadata: {
      duration: await getVideoDuration(videoFile),
      dimensions: await getVideoDimensions(videoFile),
      fps: await getVideoFPS(videoFile),
      timestamps: finalTimestamps
    }
  };
};

// Smart scene detection helper
const detectSceneChanges = async (
  ffmpeg: FFmpeg,
  videoFile: File,
  targetCount: number = 5
): Promise<number[]> => {
  // Use FFmpeg scene detection to find visually interesting moments
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
  
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vf', 'select=gt(scene\\,0.3)',
    '-vsync', 'vfr',
    '-f', 'null',
    '-'
  ]);
  
  // Parse scene detection output and return optimal timestamps
  // Fallback to evenly distributed timestamps if scene detection fails
  const duration = await getVideoDuration(videoFile);
  return Array.from({ length: targetCount }, (_, i) => 
    (duration / (targetCount + 1)) * (i + 1)
  );
};
```

#### 1.2 Create Thumbnail Cache System
**File**: `apps/web/src/lib/thumbnail-cache.ts` (new file)

```typescript
interface ThumbnailCacheEntry {
  url: string;
  timestamp: number;
  resolution: 'low' | 'medium' | 'high';
  size: number;
  lastAccessed: number;
}

interface VideoThumbnailCache {
  [mediaId: string]: {
    [timestamp: number]: ThumbnailCacheEntry;
  };
}

export class ThumbnailCacheManager {
  private cache: VideoThumbnailCache = {};
  private maxCacheSize = 50 * 1024 * 1024; // 50MB cache limit
  private currentCacheSize = 0;

  // Use existing storage infrastructure
  constructor(private storage: any) {} // Use existing OPFS/IndexedDB

  async cacheThumbnail(
    mediaId: string,
    timestamp: number,
    thumbnailUrl: string,
    resolution: 'low' | 'medium' | 'high'
  ): Promise<void> {
    // Integrate with existing storage system
    // Store thumbnail in OPFS for persistence
  }

  getThumbnail(mediaId: string, timestamp: number): string | null {
    return this.cache[mediaId]?.[timestamp]?.url || null;
  }

  // LRU cache eviction
  private evictLeastRecentlyUsed(): void {
    // Implement LRU eviction when cache is full
  }
}
```

### Phase 2: Enhanced MediaStore Integration (1 day)

#### 2.1 Extend Existing MediaItem Interface
**File**: `apps/web/src/stores/media-store.ts` (modify existing)

```typescript
// Extend existing MediaItem interface (already has thumbnailUrl!)
export interface MediaItem {
  // ... existing properties (id, name, type, file, url, thumbnailUrl, etc.)
  
  // NEW: Enhanced thumbnail properties
  thumbnails?: string[]; // Multiple thumbnail URLs for scrubbing
  thumbnailTimestamps?: number[]; // Timestamps for each thumbnail
  thumbnailResolution?: 'low' | 'medium' | 'high'; // Current quality level
  thumbnailError?: string; // Error message if generation failed
  thumbnailMetadata?: {
    sceneDetected?: boolean;
    generatedAt: number;
    cacheSize: number;
  };
}

// Extend existing MediaStore interface
interface MediaStore {
  // ... existing methods (addMediaItems, removeMediaItem, etc.)
  
  // NEW: Enhanced thumbnail methods
  generateEnhancedThumbnails: (mediaId: string, options?: EnhancedThumbnailOptions) => Promise<void>;
  getThumbnailAtTime: (mediaId: string, timestamp: number) => string | null;
  setThumbnailQuality: (mediaId: string, quality: 'low' | 'medium' | 'high') => Promise<void>;
  clearThumbnailCache: () => void;
}
```

#### 2.2 Enhance Existing processMediaFiles Function
```typescript
// In media-store.ts - enhance existing processMediaFiles function
const processMediaFiles = async (files: File[], projectId: string | null) => {
  // ... existing file processing logic
  
  // NEW: Enhanced thumbnail generation for videos
  for (const file of videoFiles) {
    try {
      // Use enhanced thumbnail generation instead of basic
      const { thumbnails, metadata } = await generateEnhancedThumbnails(file, {
        resolution: 'medium',
        timestamps: [1, file.duration * 0.25, file.duration * 0.5, file.duration * 0.75],
        sceneDetection: true
      });
      
      mediaItem.thumbnailUrl = thumbnails[0]; // Primary thumbnail
      mediaItem.thumbnails = thumbnails; // All thumbnails for scrubbing
      mediaItem.thumbnailTimestamps = metadata.timestamps;
      mediaItem.thumbnailResolution = 'medium';
      
    } catch (error) {
      console.warn(`Enhanced thumbnail generation failed for ${file.name}, using fallback:`, error);
      
      // Fallback to existing basic thumbnail generation
      try {
        const basicThumbnail = await generateThumbnail(file);
        mediaItem.thumbnailUrl = basicThumbnail;
        mediaItem.thumbnailError = undefined;
      } catch (fallbackError) {
        mediaItem.thumbnailError = fallbackError.message;
      }
    }
  }
  
  // ... rest of existing processing logic
};

// NEW: Additional store methods
generateEnhancedThumbnails: async (mediaId, options = {}) => {
  const item = get().mediaItems.find(item => item.id === mediaId);
  if (!item || !item.file || item.type !== 'video') return;
  
  try {
    const { thumbnails, metadata } = await generateEnhancedThumbnails(item.file, options);
    
    set((state) => ({
      mediaItems: state.mediaItems.map(existing => 
        existing.id === mediaId 
          ? { 
              ...existing, 
              thumbnails,
              thumbnailTimestamps: metadata.timestamps,
              thumbnailUrl: thumbnails[0],
              thumbnailError: undefined,
              thumbnailMetadata: {
                sceneDetected: options.sceneDetection || false,
                generatedAt: Date.now(),
                cacheSize: thumbnails.length
              }
            }
          : existing
      )
    }));
  } catch (error) {
    set((state) => ({
      mediaItems: state.mediaItems.map(existing => 
        existing.id === mediaId 
          ? { ...existing, thumbnailError: error.message }
          : existing
      )
    }));
  }
},

getThumbnailAtTime: (mediaId, timestamp) => {
  const item = get().mediaItems.find(item => item.id === mediaId);
  if (!item?.thumbnails || !item?.thumbnailTimestamps) return null;
  
  // Find closest thumbnail to requested timestamp
  let closestIndex = 0;
  let minDiff = Math.abs(item.thumbnailTimestamps[0] - timestamp);
  
  for (let i = 1; i < item.thumbnailTimestamps.length; i++) {
    const diff = Math.abs(item.thumbnailTimestamps[i] - timestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  
  return item.thumbnails[closestIndex];
},
```

### Phase 3: Enhanced UI Components (1 day)

#### 3.1 Enhance Existing Media View renderPreview Function
**File**: `apps/web/src/components/editor/media-panel/views/media.tsx` (modify existing)

```typescript
// Enhance existing renderPreview function in MediaView component
const renderPreview = (item: MediaItem) => {
  if (item.type === "video") {
    return <EnhancedVideoPreview item={item} />;
  }
  
  // ... existing logic for other media types
};

// NEW: Enhanced video preview component
const EnhancedVideoPreview = ({ item }: { item: MediaItem }) => {
  const [currentThumbnail, setCurrentThumbnail] = useState(item.thumbnailUrl);
  const [isHovering, setIsHovering] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const { getThumbnailAtTime, generateEnhancedThumbnails } = useMediaStore();

  // Handle thumbnail scrubbing on hover
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isHovering || !item.duration || !item.thumbnails) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    const timestamp = position * item.duration;
    
    const thumbnail = getThumbnailAtTime(item.id, timestamp);
    if (thumbnail) {
      setCurrentThumbnail(thumbnail);
      setScrubPosition(position);
    }
  };

  // Reset to primary thumbnail when not hovering
  const handleMouseLeave = () => {
    setIsHovering(false);
    setCurrentThumbnail(item.thumbnailUrl);
    setScrubPosition(0);
  };

  // Generate enhanced thumbnails if not available
  useEffect(() => {
    if (item.type === 'video' && !item.thumbnails && !item.thumbnailError) {
      generateEnhancedThumbnails(item.id, {
        resolution: 'medium',
        sceneDetection: true
      });
    }
  }, [item.id]);

  if (item.thumbnailError) {
    return (
      <div className="relative w-full h-full bg-muted flex items-center justify-center">
        <Video className="h-8 w-8 text-muted-foreground" />
        <div className="absolute bottom-1 left-1 text-xs text-red-500">
          Thumbnail failed
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-full cursor-pointer group"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* Enhanced thumbnail display */}
      <img 
        src={currentThumbnail || item.thumbnailUrl} 
        className="w-full h-full object-cover rounded transition-all duration-150" 
        alt={`Thumbnail for ${item.name}`}
      />
      
      {/* Existing gradient and video icon */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-transparent"></div>
      <Video className="h-4 w-4 text-white absolute top-1 right-1" />
      
      {/* Enhanced duration badge */}
      {item.duration && (
        <div className="absolute bottom-1 right-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs px-1.5 py-0.5 rounded">
          {formatDuration(item.duration)}
        </div>
      )}
      
      {/* NEW: Scrub position indicator */}
      {isHovering && item.thumbnails && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
          <div 
            className="h-full bg-white/80 transition-all duration-75"
            style={{ width: `${scrubPosition * 100}%` }}
          />
        </div>
      )}
      
      {/* NEW: Quality indicator */}
      {item.thumbnailMetadata?.sceneDetected && (
        <div className="absolute top-1 left-1 bg-green-500/80 text-white text-xs px-1 py-0.5 rounded">
          HD
        </div>
      )}
      
      {/* NEW: Multiple thumbnails indicator */}
      {item.thumbnails && item.thumbnails.length > 1 && (
        <div className="absolute top-1 left-1 bg-blue-500/80 text-white text-xs px-1 py-0.5 rounded">
          {item.thumbnails.length}
        </div>
      )}
    </div>
  );
};
```

#### 3.2 Add Thumbnail Quality Controls 
**File**: `apps/web/src/components/editor/media-panel/views/media.tsx` (add to existing MediaView)

```typescript
// Add thumbnail controls to existing MediaView component
const ThumbnailControls = () => {
  const { mediaItems, generateEnhancedThumbnails, clearThumbnailCache } = useMediaStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleRegenerateAll = async (quality: 'low' | 'medium' | 'high') => {
    setIsGenerating(true);
    const videoItems = mediaItems.filter(item => item.type === 'video');
    
    for (const item of videoItems) {
      await generateEnhancedThumbnails(item.id, {
        resolution: quality,
        sceneDetection: true,
        timestamps: quality === 'high' ? [1, 5, 10, 15, 20] : [1, 5, 10]
      });
    }
    
    setIsGenerating(false);
  };

  return (
    <div className="flex gap-2 mb-4 p-2 bg-muted rounded-lg">
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRegenerateAll('low')}
          disabled={isGenerating}
        >
          {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Low'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRegenerateAll('medium')}
          disabled={isGenerating}
        >
          Medium
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRegenerateAll('high')}
          disabled={isGenerating}
        >
          High
        </Button>
      </div>
      
      <Button
        size="sm"
        variant="ghost"
        onClick={clearThumbnailCache}
      >
        Clear Cache
      </Button>
    </div>
  );
};

// Add to existing MediaView component
export function MediaView() {
  // ... existing MediaView logic
  
  return (
    <div className="p-4">
      {/* Existing upload area */}
      {/* ... existing upload logic */}
      
      {/* NEW: Add thumbnail controls */}
      {mediaItems.some(item => item.type === 'video') && <ThumbnailControls />}
      
      {/* Existing media grid */}
      <div className="grid grid-cols-4 gap-2">
        {mediaItems.map((item) => (
          <DraggableMediaItem key={item.id} item={item}>
            {renderPreview(item)} {/* This will use our enhanced preview */}
          </DraggableMediaItem>
        ))}
      </div>
    </div>
  );
}
```

### Phase 4: Testing and Quality Assurance (1 day)

#### 4.1 Unit Tests for Enhanced FFmpeg Utils
**File**: `apps/web/src/__tests__/ffmpeg-utils.test.ts` (extend existing)

```typescript
// Add tests for enhanced thumbnail generation
describe('Enhanced FFmpeg Thumbnail Generation', () => {
  test('generates multiple thumbnails at different timestamps', async () => {
    const videoFile = new File(['mock video'], 'test.mp4', { type: 'video/mp4' });
    const options = {
      timestamps: [1, 5, 10],
      resolution: 'medium' as const,
      sceneDetection: false
    };
    
    const result = await generateEnhancedThumbnails(videoFile, options);
    
    expect(result.thumbnails).toHaveLength(3);
    expect(result.metadata.timestamps).toEqual([1, 5, 10]);
    expect(result.thumbnails[0]).toMatch(/^blob:/);
  });

  test('falls back to basic thumbnail on enhanced generation failure', async () => {
    // Test fallback mechanism in processMediaFiles
    const mockFile = new File(['mock video'], 'test.mp4', { type: 'video/mp4' });
    
    // Mock enhanced generation to fail
    jest.spyOn(require('../lib/ffmpeg-utils'), 'generateEnhancedThumbnails')
      .mockRejectedValueOnce(new Error('FFmpeg error'));
    
    // Should fall back to basic generateThumbnail
    const result = await processMediaFiles([mockFile], 'test-project');
    expect(result[0].thumbnailUrl).toBeDefined();
    expect(result[0].thumbnailError).toBeUndefined();
  });

  test('scene detection finds optimal timestamps', async () => {
    const videoFile = new File(['mock video'], 'test.mp4', { type: 'video/mp4' });
    const options = {
      timestamps: [1, 5, 10],
      sceneDetection: true
    };
    
    const result = await generateEnhancedThumbnails(videoFile, options);
    
    // Scene detection should return different timestamps than input
    expect(result.metadata.timestamps).not.toEqual([1, 5, 10]);
    expect(result.metadata.timestamps.length).toBeGreaterThan(0);
  });
});
```

#### 4.2 Integration Tests
**File**: `apps/web/e2e/enhanced-video-thumbnails.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Enhanced Video Thumbnails', () => {
  test('hover scrubbing works on video thumbnails', async ({ page }) => {
    // Upload video file
    await page.goto('/editor/project');
    await page.setInputFiles('input[type="file"]', './test-assets/sample-video.mp4');
    
    // Wait for enhanced thumbnail generation
    await page.waitForSelector('[data-testid="video-thumbnail"]', { timeout: 15000 });
    
    // Hover over video thumbnail
    const thumbnail = page.locator('[data-testid="video-thumbnail"]').first();
    await thumbnail.hover();
    
    // Should show scrub position indicator
    await expect(page.locator('.scrub-position-indicator')).toBeVisible();
    
    // Move mouse to different position
    const box = await thumbnail.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      
      // Thumbnail should change
      const newSrc = await thumbnail.locator('img').getAttribute('src');
      expect(newSrc).toBeDefined();
    }
  });

  test('thumbnail quality controls work', async ({ page }) => {
    await page.goto('/editor/project');
    await page.setInputFiles('input[type="file"]', './test-assets/sample-video.mp4');
    
    // Wait for video to be processed
    await page.waitForSelector('[data-testid="video-thumbnail"]');
    
    // Click high quality button
    await page.click('button:has-text("High")');
    
    // Should show loading state
    await expect(page.locator('button:has(.animate-spin)')).toBeVisible();
    
    // Wait for completion
    await page.waitForSelector('button:has-text("High"):not([disabled])', { timeout: 20000 });
    
    // Verify thumbnail was regenerated
    const thumbnail = page.locator('[data-testid="video-thumbnail"] img').first();
    const src = await thumbnail.getAttribute('src');
    expect(src).toBeDefined();
  });
});
```

## Refined File Structure (Based on Existing Architecture)

```
apps/web/src/
├── lib/
│   ├── ffmpeg-utils.ts                     # MODIFY: Add generateEnhancedThumbnails function
│   └── thumbnail-cache.ts                  # NEW: Thumbnail caching system
├── stores/
│   └── media-store.ts                      # MODIFY: Extend MediaItem interface and add methods
├── components/editor/media-panel/views/
│   └── media.tsx                           # MODIFY: Enhance renderPreview function
└── __tests__/
    ├── ffmpeg-utils.test.ts               # MODIFY: Add enhanced thumbnail tests
    └── enhanced-video-thumbnails.spec.ts  # NEW: E2E tests

# Files to modify (not create new):
- ffmpeg-utils.ts (add enhanced generation)
- media-store.ts (extend interface and methods)  
- media.tsx (enhance existing renderPreview)
```

## Technical Considerations (Aligned with Existing Architecture)

### Leverage Existing Infrastructure
- **FFmpeg.wasm**: Build upon existing generateThumbnail function
- **Media Processing**: Integrate with existing processMediaFiles pipeline
- **Storage**: Use existing OPFS/IndexedDB storage for thumbnail cache
- **UI Components**: Enhance existing renderPreview function, don't replace

### Memory Management (Already Well-Handled)
- **Existing**: 160x120 thumbnail size for memory efficiency
- **Enhancement**: Add resolution options (low/medium/high) with cache limits
- **Existing**: Object URL cleanup handled properly
- **Enhancement**: Add LRU cache eviction for long-term stability

### Performance (Building on Existing)
- **Existing**: Dual approach (FFmpeg + Canvas fallback)
- **Enhancement**: Add multiple thumbnails with scene detection
- **Existing**: Progress tracking and user feedback
- **Enhancement**: Add hover scrubbing and quality controls

### Error Handling (Already Robust)
- **Existing**: Comprehensive error handling with fallbacks
- **Enhancement**: Add error states for specific thumbnail failures
- **Existing**: User-friendly error messages
- **Enhancement**: Add retry mechanisms for enhanced features

## Implementation Priority (Refined)

1. **Day 1**: Enhance existing `generateThumbnail` function with multiple timestamps and scene detection
2. **Day 2**: Extend MediaStore interface and integrate enhanced generation into `processMediaFiles`
3. **Day 3**: Enhance existing `renderPreview` function with hover scrubbing and quality indicators
4. **Day 4**: Add comprehensive testing and polish

**Total Time: 4 days** (reduced from original 6-7 days due to leveraging existing infrastructure)

## Success Metrics (Realistic Based on Existing System)

- ✅ **Enhanced Quality**: Videos show higher quality thumbnails with scene detection
- ✅ **Hover Scrubbing**: Users can scrub through video content on hover
- ✅ **Multiple Resolutions**: Quality options (low/medium/high) work reliably
- ✅ **Performance**: No regression in existing thumbnail generation speed
- ✅ **Backward Compatibility**: Existing videos continue to work with basic thumbnails
- ✅ **Graceful Degradation**: Enhanced features fail gracefully to existing functionality

## Key Advantages of This Refined Approach

1. **Builds on Strengths**: Leverages existing robust FFmpeg.wasm integration
2. **Minimal Risk**: Enhances existing functions rather than replacing them
3. **Backward Compatible**: Existing functionality remains unchanged
4. **Incremental**: Can be implemented and deployed incrementally
5. **Maintainable**: Follows existing code patterns and architecture
6. **Realistic Timeline**: 4 days vs 6-7 days due to existing infrastructure

## Implementation Note

This refined plan recognizes that **OpenCut already has excellent video thumbnail infrastructure**. Instead of rebuilding from scratch, we enhance the existing system with:

- **Enhanced FFmpeg processing** for multiple thumbnails and scene detection
- **Extended MediaStore** for better thumbnail management
- **Improved UI components** for hover scrubbing and quality controls
- **Comprehensive testing** to ensure reliability

This approach maximizes value while minimizing risk and development time.