"use client";

import { useRef, useState, useEffect } from "react";
import { TimelineTrack } from "@/types/timeline";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { useTimelinePlayhead } from "@/hooks/use-timeline-playhead";

interface TimelinePlayheadProps {
  currentTime: number;
  duration: number;
  zoomLevel: number;
  tracks: TimelineTrack[];
  seek: (time: number) => void;
  rulerRef: React.RefObject<HTMLDivElement>;
  rulerScrollRef: React.RefObject<HTMLDivElement>;
  tracksScrollRef: React.RefObject<HTMLDivElement>;
  trackLabelsRef?: React.RefObject<HTMLDivElement>;
  timelineRef: React.RefObject<HTMLDivElement>;
  playheadRef?: React.RefObject<HTMLDivElement>;
  isSnappingToPlayhead?: boolean;
}

export function TimelinePlayhead({
  currentTime,
  duration,
  zoomLevel,
  tracks,
  seek,
  rulerRef,
  rulerScrollRef,
  tracksScrollRef,
  trackLabelsRef,
  timelineRef,
  playheadRef: externalPlayheadRef,
  isSnappingToPlayhead = false,
}: TimelinePlayheadProps) {
  const internalPlayheadRef = useRef<HTMLDivElement>(null);
  const playheadRef = externalPlayheadRef || internalPlayheadRef;
  const [scrollLeft, setScrollLeft] = useState(0);

  const { playheadPosition, handlePlayheadMouseDown } = useTimelinePlayhead({
    currentTime,
    duration,
    zoomLevel,
    seek,
    rulerRef,
    rulerScrollRef,
    tracksScrollRef,
    playheadRef,
  });

  // Track scroll position to lock playhead to frame
  useEffect(() => {
    const tracksViewport =
      (tracksScrollRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement | null) || tracksScrollRef.current;

    if (!tracksViewport) return;

    const handleScroll = () => {
      setScrollLeft(tracksViewport.scrollLeft);
    };

    // Set initial scroll position
    setScrollLeft(tracksViewport.scrollLeft);

    tracksViewport.addEventListener("scroll", handleScroll);
    return () => tracksViewport.removeEventListener("scroll", handleScroll);
  }, [tracksScrollRef]);

  // Use timeline container height minus a few pixels for breathing room
  const timelineContainerHeight = timelineRef.current?.offsetHeight || 400;
  const totalHeight = timelineContainerHeight - 4;

  // Get dynamic track labels width, fallback to 0 if no tracks or no ref
  const trackLabelsWidth =
    tracks.length > 0 && trackLabelsRef?.current
      ? trackLabelsRef.current.offsetWidth
      : 0;

  // Calculate position locked to timeline content (accounting for scroll)
  const timelinePosition =
    playheadPosition * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;
  const rawLeftPosition = trackLabelsWidth + timelinePosition - scrollLeft;

  // Get the timeline content width and viewport width for right boundary
  const timelineContentWidth =
    duration * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;
  const tracksViewport =
    (tracksScrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null) || tracksScrollRef.current;
  const viewportWidth = tracksViewport?.clientWidth || 1000;

  // Constrain playhead to never appear outside the timeline area
  const leftBoundary = trackLabelsWidth;
  const rightBoundary = Math.min(
    trackLabelsWidth + timelineContentWidth - scrollLeft, // Don't go beyond timeline content
    trackLabelsWidth + viewportWidth // Don't go beyond viewport
  );

  const leftPosition = Math.max(
    leftBoundary,
    Math.min(rightBoundary, rawLeftPosition)
  );

  // Debug logging when playhead might go outside
  if (rawLeftPosition < leftBoundary || rawLeftPosition > rightBoundary) {
    console.log(
      "PLAYHEAD VISUAL DEBUG:",
      JSON.stringify({
        playheadPosition,
        timelinePosition,
        trackLabelsWidth,
        scrollLeft,
        rawLeftPosition,
        constrainedLeftPosition: leftPosition,
        leftBoundary,
        rightBoundary,
        timelineContentWidth,
        viewportWidth,
        zoomLevel,
      })
    );
  }

  return (
    <div
      ref={playheadRef}
      className="absolute pointer-events-auto z-150"
      style={{
        left: `${leftPosition}px`,
        top: 0,
        height: `${totalHeight}px`,
        width: "2px", // Slightly wider for better click target
      }}
      onMouseDown={handlePlayheadMouseDown}
    >
      {/* The playhead line spanning full height */}
      <div
        className={`absolute left-0 w-0.5 cursor-col-resize h-full ${isSnappingToPlayhead ? "bg-foreground" : "bg-foreground"}`}
      />

      {/* Playhead dot indicator at the top (in ruler area) */}
      <div
        className={`absolute top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full border-2 shadow-xs ${isSnappingToPlayhead ? "bg-foreground border-foreground" : "bg-foreground border-foreground/50"}`}
      />
    </div>
  );
}

// Also export a hook for getting ruler handlers
export function useTimelinePlayheadRuler({
  currentTime,
  duration,
  zoomLevel,
  seek,
  rulerRef,
  rulerScrollRef,
  tracksScrollRef,
  playheadRef,
}: Omit<TimelinePlayheadProps, "tracks" | "trackLabelsRef" | "timelineRef">) {
  const { handleRulerMouseDown, isDraggingRuler } = useTimelinePlayhead({
    currentTime,
    duration,
    zoomLevel,
    seek,
    rulerRef,
    rulerScrollRef,
    tracksScrollRef,
    playheadRef,
  });

  return { handleRulerMouseDown, isDraggingRuler };
}

export { TimelinePlayhead as default };
