import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Timeline } from '../index'

// Mock the stores and hooks
vi.mock('@/stores/timeline-store', () => ({
  useTimelineStore: () => ({
    tracks: [],
    addTrack: vi.fn(),
    addElementToTrack: vi.fn(),
    removeElementFromTrack: vi.fn(),
    removeElementFromTrackWithRipple: vi.fn(),
    selectedElements: [],
    clearSelectedElements: vi.fn(),
    splitElement: vi.fn(),
    splitAndKeepLeft: vi.fn(),
    splitAndKeepRight: vi.fn(),
    separateAudio: vi.fn(),
    snappingEnabled: false,
    toggleSnapping: vi.fn(),
    deleteElements: vi.fn(),
    duplicateElement: vi.fn(),
    selectAll: vi.fn(),
    zoomLevel: 1,
    setZoomLevel: vi.fn(),
    dragState: { isDragging: false, draggedElement: null, dragOffset: { x: 0, y: 0 } },
    getTotalDuration: () => 100,
    setSelectedElements: vi.fn(),
    toggleTrackMute: vi.fn(),
  })
}))

vi.mock('@/stores/media-store', () => ({
  useMediaStore: () => ({
    mediaItems: [],
    addMediaItem: vi.fn(),
  })
}))

vi.mock('@/stores/project-store', () => ({
  useProjectStore: () => ({
    activeProject: null,
  })
}))

const mockSeek = vi.fn()

vi.mock('@/stores/playback-store', () => ({
  usePlaybackStore: () => ({
    currentTime: 0,
    duration: 100,
    seek: mockSeek,
    setDuration: vi.fn(),
    isPlaying: false,
    toggle: vi.fn(),
  }),
}))

// Mock the timeline playhead hook
vi.mock('@/hooks/use-timeline-playhead', () => ({
  useTimelinePlayhead: () => ({
    playheadRef: { current: null },
    updatePlayheadPosition: vi.fn(),
    onPlayheadDrag: vi.fn(),
  })
}))

vi.mock('@/hooks/use-editor-actions', () => ({
  useEditorActions: () => ({})
}))

vi.mock('@/hooks/use-timeline-context-menu', () => ({
  useTimelineContextMenu: () => ({
    contextMenu: null,
    handleContextMenu: vi.fn(),
    closeContextMenu: vi.fn(),
  })
}))

vi.mock('@/hooks/use-timeline-selection', () => ({
  useTimelineSelection: () => ({
    isSelecting: false,
    selectionBox: null,
    handleMouseDown: vi.fn(),
  })
}))

vi.mock('@/hooks/use-timeline-drag-drop', () => ({
  useTimelineDragDrop: () => ({
    dragProps: {},
  })
}))

// Mock UI components to avoid dependency issues
vi.mock('../../ui/tooltip', () => ({
  Tooltip: ({ children }: any) => children,
  TooltipTrigger: ({ children }: any) => children,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => children,
}))

vi.mock('../../ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props} aria-label={props['aria-label']}>
      {children}
    </button>
  ),
}))

vi.mock('../../ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('lucide-react', () => ({
  SkipBack: () => <svg data-testid="skip-back-icon" />,
  Play: () => <svg data-testid="play-icon" />,
  Pause: () => <svg data-testid="pause-icon" />,
  Scissors: () => <svg />,
  ArrowLeftToLine: () => <svg />,
  ArrowRightToLine: () => <svg />,
  Trash2: () => <svg />,
  Snowflake: () => <svg />,
  Copy: () => <svg />,
  SplitSquareHorizontal: () => <svg />,
  Video: () => <svg />,
  Music: () => <svg />,
  TypeIcon: () => <svg />,
  Magnet: () => <svg />,
  Link: () => <svg />,
  ZoomIn: () => <svg />,
  ZoomOut: () => <svg />,
}))

vi.mock('@/constants/timeline', () => ({
  TIMELINE_CONSTANTS: {
    DEFAULT_TEXT_DURATION: 5,
  }
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.join(' '),
  snapTimeToFrame: (time: number) => time,
}))

// Mock timeline utilities
vi.mock('@/lib/timeline-utils', () => ({
  getTotalDuration: () => 100,
  getCurrentSnapPoint: () => null,
}))

// Mock context menu components
vi.mock('../../ui/context-menu', () => ({
  ContextMenu: ({ children }: any) => children,
  ContextMenuTrigger: ({ children }: any) => children,
  ContextMenuContent: ({ children }: any) => <div>{children}</div>,
  ContextMenuItem: ({ children }: any) => <div>{children}</div>,
  ContextMenuSeparator: () => <div />,
}))

// Mock dialog components
vi.mock('../../ui/dialog', () => ({
  Dialog: ({ children }: any) => children,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}))

describe('Timeline - Return to Start Button', () => {
  beforeEach(() => {
    mockSeek.mockClear()
  })

  it('should render Return to Start button', () => {
    render(<Timeline />)
    
    // Look for the SkipBack icon which indicates our button
    const skipBackIcon = screen.getByTestId('skip-back-icon')
    expect(skipBackIcon).toBeInTheDocument()
  })

  it('should call seek(0) when Return to Start button is clicked', () => {
    render(<Timeline />)
    
    // Find the button that contains the SkipBack icon
    const skipBackIcon = screen.getByTestId('skip-back-icon')
    const button = skipBackIcon.closest('button')
    
    expect(button).toBeInTheDocument()
    fireEvent.click(button!)
    
    expect(mockSeek).toHaveBeenCalledWith(0)
  })

  it('should have tooltip structure for Return to Start button', () => {
    render(<Timeline />)
    
    // Find the skip back button and verify it's wrapped in tooltip components
    const skipBackIcon = screen.getByTestId('skip-back-icon')
    const button = skipBackIcon.closest('button')
    
    expect(button).toBeInTheDocument()
    // The button should exist and be clickable, which means the tooltip structure is in place
    expect(button).toHaveAttribute('data-state', 'closed') // Tooltip trigger state
  })

  it('should have SkipBack icon in Return to Start button', () => {
    render(<Timeline />)
    
    const skipBackIcon = screen.getByTestId('skip-back-icon')
    expect(skipBackIcon).toBeInTheDocument()
    
    // Verify it's inside a button
    const button = skipBackIcon.closest('button')
    expect(button).toBeInTheDocument()
  })
})