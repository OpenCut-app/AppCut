"use client";

import { useRef, useState, useEffect } from "react";
import { useTimelineStore } from "@/stores/timeline-store";
import { generateVideoThumbnail, getImageDimensions, getMediaDuration, useMediaStore } from "@/stores/media-store";
import { toast } from "sonner";
import { TimelineElement } from "./timeline-element";
import {
  TimelineTrack,
  sortTracksByOrder,
  ensureMainTrack,
  getMainTrack,
  canElementGoOnTrack,
} from "@/types/timeline";
import { usePlaybackStore } from "@/stores/playback-store";
import type {
  TimelineElement as TimelineElementType,
  DragData,
} from "@/types/timeline";
import {
  snapTimeToFrame,
  TIMELINE_CONSTANTS,
} from "@/constants/timeline-constants";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineSnapping, SnapPoint } from "@/hooks/use-timeline-snapping";

export function TimelineTrackContent({
  track,
  zoomLevel,
  onSnapPointChange,
}: {
  track: TimelineTrack;
  zoomLevel: number;
  onSnapPointChange?: (snapPoint: SnapPoint | null) => void;
}) {
  const { mediaItems, addMediaItem } = useMediaStore();
  const {
    tracks,
    addTrack,
    moveElementToTrack,
    updateElementStartTime,
    updateElementStartTimeWithRipple,
    addElementToTrack,
    selectedElements,
    selectElement,
    dragState,
    startDrag: startDragAction,
    updateDragTime,
    endDrag: endDragAction,
    clearSelectedElements,
    insertTrackAt,
    snappingEnabled,
    rippleEditingEnabled,
  } = useTimelineStore();

  const { currentTime } = usePlaybackStore();

  // Initialize snapping hook
  const { snapElementPosition, snapElementEdge } = useTimelineSnapping({
    snapThreshold: 10,
    enableElementSnapping: snappingEnabled,
    enablePlayheadSnapping: snappingEnabled,
  });

  // Helper function for drop snapping that tries both edges
  const getDropSnappedTime = (
    dropTime: number,
    elementDuration: number,
    excludeElementId?: string
  ) => {
    if (!snappingEnabled) {
      // Use frame snapping if project has FPS, otherwise use decimal snapping
      const projectStore = useProjectStore.getState();
      const projectFps = projectStore.activeProject?.fps || 30;
      return snapTimeToFrame(dropTime, projectFps);
    }

    // Try snapping both start and end edges for drops
    const startSnapResult = snapElementEdge(
      dropTime,
      elementDuration,
      tracks,
      currentTime,
      zoomLevel,
      excludeElementId,
      true // snap to start edge
    );

    const endSnapResult = snapElementEdge(
      dropTime,
      elementDuration,
      tracks,
      currentTime,
      zoomLevel,
      excludeElementId,
      false // snap to end edge
    );

    // Choose the snap result with the smaller distance (closer snap)
    let bestSnapResult = startSnapResult;
    if (
      endSnapResult.snapPoint &&
      (!startSnapResult.snapPoint ||
        endSnapResult.snapDistance < startSnapResult.snapDistance)
    ) {
      bestSnapResult = endSnapResult;
    }

    return bestSnapResult.snappedTime;
  };

  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDropping, setIsDropping] = useState(false);
  const [dropPosition, setDropPosition] = useState<number | null>(null);
  const [wouldOverlap, setWouldOverlap] = useState(false);
  const dragCounterRef = useRef(0);
  const [mouseDownLocation, setMouseDownLocation] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Set up mouse event listeners for drag
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;

      // On first mouse move during drag, ensure the element is selected
      if (dragState.elementId && dragState.trackId) {
        const isSelected = selectedElements.some(
          (c) =>
            c.trackId === dragState.trackId &&
            c.elementId === dragState.elementId
        );

        if (!isSelected) {
          // Select this element (replacing other selections) since we're dragging it
          selectElement(dragState.trackId, dragState.elementId, false);
        }
      }

      const timelineRect = timelineRef.current.getBoundingClientRect();
      const mouseX = e.clientX - timelineRect.left;
      const mouseTime = Math.max(
        0,
        mouseX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel)
      );
      const adjustedTime = Math.max(0, mouseTime - dragState.clickOffsetTime);

      // Apply snapping if enabled
      let finalTime = adjustedTime;
      let snapPoint = null;
      if (snappingEnabled) {
        // Find the element being dragged to get its duration
        let elementDuration = 5; // fallback duration
        if (dragState.elementId && dragState.trackId) {
          const sourceTrack = tracks.find((t) => t.id === dragState.trackId);
          const element = sourceTrack?.elements.find(
            (e) => e.id === dragState.elementId
          );
          if (element) {
            elementDuration =
              element.duration - element.trimStart - element.trimEnd;
          }
        }

        // Try snapping both start and end edges
        const startSnapResult = snapElementEdge(
          adjustedTime,
          elementDuration,
          tracks,
          currentTime,
          zoomLevel,
          dragState.elementId || undefined,
          true // snap to start edge
        );

        const endSnapResult = snapElementEdge(
          adjustedTime,
          elementDuration,
          tracks,
          currentTime,
          zoomLevel,
          dragState.elementId || undefined,
          false // snap to end edge
        );

        // Choose the snap result with the smaller distance (closer snap)
        let bestSnapResult = startSnapResult;
        if (
          endSnapResult.snapPoint &&
          (!startSnapResult.snapPoint ||
            endSnapResult.snapDistance < startSnapResult.snapDistance)
        ) {
          bestSnapResult = endSnapResult;
        }

        finalTime = bestSnapResult.snappedTime;
        snapPoint = bestSnapResult.snapPoint;

        // Notify parent component about snap point change
        onSnapPointChange?.(snapPoint);
      } else {
        // Use frame snapping if project has FPS, otherwise use decimal snapping
        const projectStore = useProjectStore.getState();
        const projectFps = projectStore.activeProject?.fps || 30;
        finalTime = snapTimeToFrame(adjustedTime, projectFps);

        // Clear snap point when not snapping
        onSnapPointChange?.(null);
      }

      updateDragTime(finalTime);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragState.elementId || !dragState.trackId) return;

      // If this track initiated the drag, we should handle the mouse up regardless of where it occurs
      const isTrackThatStartedDrag = dragState.trackId === track.id;

      const timelineRect = timelineRef.current?.getBoundingClientRect();
      if (!timelineRect) {
        if (isTrackThatStartedDrag) {
          if (rippleEditingEnabled) {
            updateElementStartTimeWithRipple(
              track.id,
              dragState.elementId,
              dragState.currentTime
            );
          } else {
            updateElementStartTime(
              track.id,
              dragState.elementId,
              dragState.currentTime
            );
          }
          endDragAction();
          // Clear snap point when drag ends
          onSnapPointChange?.(null);
        }
        return;
      }

      const isMouseOverThisTrack =
        e.clientY >= timelineRect.top && e.clientY <= timelineRect.bottom;

      if (!isMouseOverThisTrack && !isTrackThatStartedDrag) return;

      const finalTime = dragState.currentTime;

      if (isMouseOverThisTrack) {
        const sourceTrack = tracks.find((t) => t.id === dragState.trackId);
        const movingElement = sourceTrack?.elements.find(
          (c) => c.id === dragState.elementId
        );

        if (movingElement) {
          const movingElementDuration =
            movingElement.duration -
            movingElement.trimStart -
            movingElement.trimEnd;
          const movingElementEnd = finalTime + movingElementDuration;

          const targetTrack = tracks.find((t) => t.id === track.id);
          const hasOverlap = targetTrack?.elements.some((existingElement) => {
            if (
              dragState.trackId === track.id &&
              existingElement.id === dragState.elementId
            ) {
              return false;
            }
            const existingStart = existingElement.startTime;
            const existingEnd =
              existingElement.startTime +
              (existingElement.duration -
                existingElement.trimStart -
                existingElement.trimEnd);
            return finalTime < existingEnd && movingElementEnd > existingStart;
          });

          if (!hasOverlap) {
            if (dragState.trackId === track.id) {
              if (rippleEditingEnabled) {
                updateElementStartTimeWithRipple(
                  track.id,
                  dragState.elementId,
                  finalTime
                );
              } else {
                updateElementStartTime(
                  track.id,
                  dragState.elementId,
                  finalTime
                );
              }
            } else {
              moveElementToTrack(
                dragState.trackId,
                track.id,
                dragState.elementId
              );
              requestAnimationFrame(() => {
                if (rippleEditingEnabled) {
                  updateElementStartTimeWithRipple(
                    track.id,
                    dragState.elementId!,
                    finalTime
                  );
                } else {
                  updateElementStartTime(
                    track.id,
                    dragState.elementId!,
                    finalTime
                  );
                }
              });
            }
          }
        }
      } else if (isTrackThatStartedDrag) {
        // Mouse is not over this track, but this track started the drag
        // This means user released over ruler/outside - update position within same track
        const sourceTrack = tracks.find((t) => t.id === dragState.trackId);
        const movingElement = sourceTrack?.elements.find(
          (c) => c.id === dragState.elementId
        );

        if (movingElement) {
          const movingElementDuration =
            movingElement.duration -
            movingElement.trimStart -
            movingElement.trimEnd;
          const movingElementEnd = finalTime + movingElementDuration;

          const hasOverlap = track.elements.some((existingElement) => {
            if (existingElement.id === dragState.elementId) {
              return false;
            }
            const existingStart = existingElement.startTime;
            const existingEnd =
              existingElement.startTime +
              (existingElement.duration -
                existingElement.trimStart -
                existingElement.trimEnd);
            return finalTime < existingEnd && movingElementEnd > existingStart;
          });

          if (!hasOverlap) {
            if (rippleEditingEnabled) {
              updateElementStartTimeWithRipple(
                track.id,
                dragState.elementId,
                finalTime
              );
            } else {
              updateElementStartTime(track.id, dragState.elementId, finalTime);
            }
          }
        }
      }

      if (isTrackThatStartedDrag) {
        endDragAction();
        // Clear snap point when drag ends
        onSnapPointChange?.(null);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    dragState.isDragging,
    dragState.clickOffsetTime,
    dragState.elementId,
    dragState.trackId,
    dragState.currentTime,
    zoomLevel,
    tracks,
    track.id,
    updateDragTime,
    updateElementStartTime,
    moveElementToTrack,
    endDragAction,
    selectedElements,
    selectElement,
    onSnapPointChange,
  ]);

  const handleElementMouseDown = (
    e: React.MouseEvent,
    element: TimelineElementType
  ) => {
    setMouseDownLocation({ x: e.clientX, y: e.clientY });

    // Detect right-click (button 2) and handle selection without starting drag
    const isRightClick = e.button === 2;
    const isMultiSelect = e.metaKey || e.ctrlKey || e.shiftKey;

    if (isRightClick) {
      // Handle right-click selection
      const isSelected = selectedElements.some(
        (c) => c.trackId === track.id && c.elementId === element.id
      );

      // If element is not selected, select it (keep other selections if multi-select)
      if (!isSelected) {
        selectElement(track.id, element.id, isMultiSelect);
      }
      // If element is already selected, keep it selected

      // Don't start drag action for right-clicks
      return;
    }

    // Handle multi-selection for left-click with modifiers
    if (isMultiSelect) {
      selectElement(track.id, element.id, true);
    }

    // Calculate the offset from the left edge of the element to where the user clicked
    const elementElement = e.currentTarget as HTMLElement;
    const elementRect = elementElement.getBoundingClientRect();
    const clickOffsetX = e.clientX - elementRect.left;
    const clickOffsetTime =
      clickOffsetX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel);

    startDragAction(
      element.id,
      track.id,
      e.clientX,
      element.startTime,
      clickOffsetTime
    );
  };

  const handleElementClick = (
    e: React.MouseEvent,
    element: TimelineElementType
  ) => {
    e.stopPropagation();

    // Check if mouse moved significantly
    if (mouseDownLocation) {
      const deltaX = Math.abs(e.clientX - mouseDownLocation.x);
      const deltaY = Math.abs(e.clientY - mouseDownLocation.y);
      // If it moved more than a few pixels, consider it a drag and not a click.
      if (deltaX > 5 || deltaY > 5) {
        setMouseDownLocation(null); // Reset for next interaction
        return;
      }
    }

    // Skip selection logic for multi-selection (handled in mousedown)
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      return;
    }

    // Handle single selection
    const isSelected = selectedElements.some(
      (c) => c.trackId === track.id && c.elementId === element.id
    );

    if (!isSelected) {
      // If element is not selected, select it (replacing other selections)
      selectElement(track.id, element.id, false);
    }
    // If element is already selected, keep it selected (do nothing)
  };

  const handleTrackDragOver = (e: React.DragEvent) => {
    e.preventDefault();

    // Handle both timeline elements and media items
    const hasTimelineElement = e.dataTransfer.types.includes(
      "application/x-timeline-element"
    );
    const hasMediaItem = e.dataTransfer.types.includes(
      "application/x-media-item"
    );

    if (!hasTimelineElement && !hasMediaItem) return;

    // Calculate drop position for overlap checking
    const trackContainer = e.currentTarget.querySelector(
      ".track-elements-container"
    ) as HTMLElement;
    let dropTime = 0;
    if (trackContainer) {
      const rect = trackContainer.getBoundingClientRect();
      const mouseX = Math.max(0, e.clientX - rect.left);
      dropTime = mouseX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel);
    }

    // Check for potential overlaps and show appropriate feedback
    let wouldOverlap = false;

    if (hasMediaItem) {
      try {
        const mediaItemData = e.dataTransfer.getData(
          "application/x-media-item"
        );
        if (mediaItemData) {
          const dragData: DragData = JSON.parse(mediaItemData);

          if (dragData.type === "text") {
            // Text elements have default duration of 5 seconds
            const newElementDuration = 5;
            const snappedTime = getDropSnappedTime(
              dropTime,
              newElementDuration
            );
            const newElementEnd = snappedTime + newElementDuration;

            wouldOverlap = track.elements.some((existingElement) => {
              const existingStart = existingElement.startTime;
              const existingEnd =
                existingElement.startTime +
                (existingElement.duration -
                  existingElement.trimStart -
                  existingElement.trimEnd);
              return snappedTime < existingEnd && newElementEnd > existingStart;
            });
          } else {
            // Media elements
            const mediaItem = mediaItems.find(
              (item) => item.id === dragData.id
            );
            if (mediaItem) {
              const newElementDuration = mediaItem.duration || 5;
              const snappedTime = getDropSnappedTime(
                dropTime,
                newElementDuration
              );
              const newElementEnd = snappedTime + newElementDuration;

              wouldOverlap = track.elements.some((existingElement) => {
                const existingStart = existingElement.startTime;
                const existingEnd =
                  existingElement.startTime +
                  (existingElement.duration -
                    existingElement.trimStart -
                    existingElement.trimEnd);
                return (
                  snappedTime < existingEnd && newElementEnd > existingStart
                );
              });
            }
          }
        }
      } catch (error) {
        // Continue with default behavior
      }
    } else if (hasTimelineElement) {
      try {
        const timelineElementData = e.dataTransfer.getData(
          "application/x-timeline-element"
        );
        if (timelineElementData) {
          const { elementId, trackId: fromTrackId } =
            JSON.parse(timelineElementData);
          const sourceTrack = tracks.find(
            (t: TimelineTrack) => t.id === fromTrackId
          );
          const movingElement = sourceTrack?.elements.find(
            (c: any) => c.id === elementId
          );

          if (movingElement) {
            const movingElementDuration =
              movingElement.duration -
              movingElement.trimStart -
              movingElement.trimEnd;
            const snappedTime = getDropSnappedTime(
              dropTime,
              movingElementDuration,
              elementId
            );
            const movingElementEnd = snappedTime + movingElementDuration;

            wouldOverlap = track.elements.some((existingElement) => {
              if (fromTrackId === track.id && existingElement.id === elementId)
                return false;

              const existingStart = existingElement.startTime;
              const existingEnd =
                existingElement.startTime +
                (existingElement.duration -
                  existingElement.trimStart -
                  existingElement.trimEnd);
              return (
                snappedTime < existingEnd && movingElementEnd > existingStart
              );
            });
          }
        }
      } catch (error) {
        // Continue with default behavior
      }
    }

    if (wouldOverlap) {
      e.dataTransfer.dropEffect = "none";
      setWouldOverlap(true);
      // Use default duration for position indicator
      setDropPosition(getDropSnappedTime(dropTime, 5));
      return;
    }

    e.dataTransfer.dropEffect = hasTimelineElement ? "move" : "copy";
    setWouldOverlap(false);
    // Use default duration for position indicator
    setDropPosition(getDropSnappedTime(dropTime, 5));
  };

  const handleTrackDragEnter = (e: React.DragEvent) => {
    e.preventDefault();

    const hasTimelineElement = e.dataTransfer.types.includes(
      "application/x-timeline-element"
    );
    const hasMediaItem = e.dataTransfer.types.includes(
      "application/x-media-item"
    );

    if (!hasTimelineElement && !hasMediaItem) return;

    dragCounterRef.current++;
    setIsDropping(true);
  };

  const handleTrackDragLeave = (e: React.DragEvent) => {
    e.preventDefault();

    const hasTimelineElement = e.dataTransfer.types.includes(
      "application/x-timeline-element"
    );
    const hasMediaItem = e.dataTransfer.types.includes(
      "application/x-media-item"
    );

    if (!hasTimelineElement && !hasMediaItem) return;

    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      setIsDropping(false);
      setWouldOverlap(false);
      setDropPosition(null);
    }
  };

	const handleTrackDrop = async (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();

    // Debug logging
    console.log(
      JSON.stringify({
        message: "Drop event started in timeline track",
        dataTransferTypes: Array.from(e.dataTransfer.types),
        trackId: track.id,
        trackType: track.type,
      })
    );

    // Reset all drag states
    dragCounterRef.current = 0;
    setIsDropping(false);
    setWouldOverlap(false);

    const hasTimelineElement = e.dataTransfer.types.includes(
      "application/x-timeline-element"
    );
    const hasMediaItem = e.dataTransfer.types.includes(
      "application/x-media-item"
    );

    if (!hasTimelineElement && !hasMediaItem) return;

    const trackContainer = e.currentTarget.querySelector(
      ".track-elements-container"
    ) as HTMLElement;
    if (!trackContainer) return;

    const rect = trackContainer.getBoundingClientRect();
    const mouseX = Math.max(0, e.clientX - rect.left);
    const mouseY = e.clientY - rect.top; // Get Y position relative to this track
    const newStartTime =
      mouseX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel);
    const projectStore = useProjectStore.getState();
    const projectFps = projectStore.activeProject?.fps || 30;
    const snappedTime = snapTimeToFrame(newStartTime, projectFps);

    // Calculate drop position relative to tracks
    const currentTrackIndex = tracks.findIndex((t) => t.id === track.id);

    // Determine drop zone within the track (top 20px, middle 20px, bottom 20px)
    let dropPosition: "above" | "on" | "below";
    if (mouseY < 20) {
      dropPosition = "above";
    } else if (mouseY > 40) {
      dropPosition = "below";
    } else {
      dropPosition = "on";
    }

    try {
      if (hasTimelineElement) {
        // Handle timeline element movement
        const timelineElementData = e.dataTransfer.getData(
          "application/x-timeline-element"
        );
        if (!timelineElementData) return;

        const {
          elementId,
          trackId: fromTrackId,
          clickOffsetTime = 0,
        } = JSON.parse(timelineElementData);

        // Find the element being moved
        const sourceTrack = tracks.find(
          (t: TimelineTrack) => t.id === fromTrackId
        );
        const movingElement = sourceTrack?.elements.find(
          (c: TimelineElementType) => c.id === elementId
        );

        if (!movingElement) {
          toast.error("Element not found");
          return;
        }

        // Check for overlaps with existing elements (excluding the moving element itself)
        const movingElementDuration =
          movingElement.duration -
          movingElement.trimStart -
          movingElement.trimEnd;

        // Adjust position based on where user clicked on the element
        const adjustedStartTime = newStartTime - clickOffsetTime;
        const snappedStartTime = getDropSnappedTime(
          adjustedStartTime,
          movingElementDuration,
          elementId
        );
        const finalStartTime = Math.max(0, snappedStartTime);
        const movingElementEnd = finalStartTime + movingElementDuration;

        const hasOverlap = track.elements.some((existingElement) => {
          // Skip the element being moved if it's on the same track
          if (fromTrackId === track.id && existingElement.id === elementId)
            return false;

          const existingStart = existingElement.startTime;
          const existingEnd =
            existingElement.startTime +
            (existingElement.duration -
              existingElement.trimStart -
              existingElement.trimEnd);

          // Check if elements overlap
          return (
            finalStartTime < existingEnd && movingElementEnd > existingStart
          );
        });

        if (hasOverlap) {
          toast.error(
            "Cannot move element here - it would overlap with existing elements"
          );
          return;
        }

        if (fromTrackId === track.id) {
          // Moving within same track
          if (rippleEditingEnabled) {
            updateElementStartTimeWithRipple(
              track.id,
              elementId,
              finalStartTime
            );
          } else {
            updateElementStartTime(track.id, elementId, finalStartTime);
          }
        } else {
          // Moving to different track
          moveElementToTrack(fromTrackId, track.id, elementId);
          requestAnimationFrame(() => {
            if (rippleEditingEnabled) {
              updateElementStartTimeWithRipple(
                track.id,
                elementId,
                finalStartTime
              );
            } else {
              updateElementStartTime(track.id, elementId, finalStartTime);
            }
          });
        }
      } else if (hasMediaItem) {
        // Handle media item drop
        const mediaItemData = e.dataTransfer.getData(
          "application/x-media-item"
        );
        if (!mediaItemData) return;

        const dragData: DragData = JSON.parse(mediaItemData);

        if (dragData.type === "text") {
          let targetTrackId = track.id;
          let targetTrack = track;

          // Handle position-aware track creation for text
          if (track.type !== "text" || dropPosition !== "on") {
            // Text tracks should go above the main track
            const mainTrack = getMainTrack(tracks);
            let insertIndex: number;

            if (dropPosition === "above") {
              insertIndex = currentTrackIndex;
            } else if (dropPosition === "below") {
              insertIndex = currentTrackIndex + 1;
            } else {
              // dropPosition === "on" but track is not text type
              // Insert above main track if main track exists, otherwise at top
              if (mainTrack) {
                const mainTrackIndex = tracks.findIndex(
                  (t) => t.id === mainTrack.id
                );
                insertIndex = mainTrackIndex;
              } else {
                insertIndex = 0; // Top of timeline
              }
            }

            targetTrackId = insertTrackAt("text", insertIndex);
            // Get the updated tracks array after creating the new track
            const updatedTracks = useTimelineStore.getState().tracks;
            const newTargetTrack = updatedTracks.find(
              (t) => t.id === targetTrackId
            );
            if (!newTargetTrack) return;
            targetTrack = newTargetTrack;
          }

          // Check for overlaps with existing elements in target track
          const newElementDuration = 5; // Default text duration
          const textSnappedTime = getDropSnappedTime(
            newStartTime,
            newElementDuration
          );
          const newElementEnd = textSnappedTime + newElementDuration;

          const hasOverlap = targetTrack.elements.some((existingElement) => {
            const existingStart = existingElement.startTime;
            const existingEnd =
              existingElement.startTime +
              (existingElement.duration -
                existingElement.trimStart -
                existingElement.trimEnd);

            // Check if elements overlap
            return (
              textSnappedTime < existingEnd && newElementEnd > existingStart
            );
          });

          if (hasOverlap) {
            toast.error(
              "Cannot place element here - it would overlap with existing elements"
            );
            return;
          }

          addElementToTrack(targetTrackId, {
            type: "text",
            name: dragData.name || "Text",
            content: dragData.content || "Default Text",
            duration: TIMELINE_CONSTANTS.DEFAULT_TEXT_DURATION,
            startTime: textSnappedTime,
            trimStart: 0,
            trimEnd: 0,
            fontSize: 48,
            fontFamily: "Arial",
            color: "#ffffff",
            backgroundColor: "transparent",
            textAlign: "center",
            fontWeight: "normal",
            fontStyle: "normal",
            textDecoration: "none",
            x: 0,
            y: 0,
            rotation: 0,
            opacity: 1,
          });


        } else {
          // Handle media items
          
          async function addToMedia() { // this will be only used if the media was a gif
            const projectStore = useProjectStore.getState();
            const projectId = projectStore.activeProject?.id;
            if (!projectId) {
              toast.error("No active project found");
              return;
            }

            const gifUrl = dragData.content
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(gifUrl)}`;
            const response = await fetch(proxyUrl);
            const blob = await response.blob();
            const file = new File([blob], "sticker.gif", { type: "image/gif" });

            const { width, height } = await getImageDimensions(file)

            const mediaItem = await addMediaItem(projectId, {
              name: dragData.name,
              type: "GIF",
              file: file,
              url: URL.createObjectURL(file),
              // url: gifUrl,
              width: width,
              height: height,

            })

            return mediaItem
            
          }

          let mediaItem;
          if (dragData.type == "GIF") {
            mediaItem = mediaItems.find((item) => item.name === dragData.name);
            if (!mediaItem) await addToMedia();
            // Refresh mediaItems from the store after adding
            const updatedMediaItems = useMediaStore.getState().mediaItems;
            mediaItem = updatedMediaItems.find((item) => item.name === dragData.name);

          } else {
            mediaItem = mediaItems.find((item) => item.id === dragData.id);
          }
          if (!mediaItem) {
            toast.error("Media item not found");
            return;
          }

          let targetTrackId = track.id;

          // Check if track type is compatible
          const isVideoOrImage =
            dragData.type === "video" || dragData.type === "image";
          const isAudio = dragData.type === "audio";
          const isCompatible = isVideoOrImage
            ? canElementGoOnTrack("media", track.type)
            : isAudio
              ? canElementGoOnTrack("media", track.type)
              : false;

          let targetTrack = tracks.find((t) => t.id === targetTrackId);

          // Handle position-aware track creation for media elements
          if (!isCompatible || dropPosition !== "on") {
            if (isVideoOrImage) {
              // For video/image, check if we need a main track or additional media track
              const mainTrack = getMainTrack(tracks);

              if (!mainTrack) {
                // No main track exists, create it
                targetTrackId = addTrack("media");
                const updatedTracks = useTimelineStore.getState().tracks;
                const newTargetTrack = updatedTracks.find(
                  (t) => t.id === targetTrackId
                );
                if (!newTargetTrack) return;
                targetTrack = newTargetTrack;
              } else if (
                mainTrack.elements.length === 0 &&
                dropPosition === "on"
              ) {
                // Main track exists and is empty, use it
                targetTrackId = mainTrack.id;
                targetTrack = mainTrack;
              } else {
                // Create new media track
                let insertIndex: number;

                if (dropPosition === "above") {
                  insertIndex = currentTrackIndex;
                } else if (dropPosition === "below") {
                  insertIndex = currentTrackIndex + 1;
                } else {
                  // Insert above main track
                  const mainTrackIndex = tracks.findIndex(
                    (t) => t.id === mainTrack.id
                  );
                  insertIndex = mainTrackIndex;
                }

                targetTrackId = insertTrackAt("media", insertIndex);
                const updatedTracks = useTimelineStore.getState().tracks;
                const newTargetTrack = updatedTracks.find(
                  (t) => t.id === targetTrackId
                );
                if (!newTargetTrack) return;
                targetTrack = newTargetTrack;
              }
            } else if (isAudio) {
              // Audio tracks go at the bottom
              const mainTrack = getMainTrack(tracks);
              let insertIndex: number;

              if (dropPosition === "above") {
                insertIndex = currentTrackIndex;
              } else if (dropPosition === "below") {
                insertIndex = currentTrackIndex + 1;
              } else {
                // Insert after main track (bottom area)
                if (mainTrack) {
                  const mainTrackIndex = tracks.findIndex(
                    (t) => t.id === mainTrack.id
                  );
                  insertIndex = mainTrackIndex + 1;
                } else {
                  insertIndex = tracks.length; // Bottom of timeline
                }
              }

              targetTrackId = insertTrackAt("audio", insertIndex);
              const updatedTracks = useTimelineStore.getState().tracks;
              const newTargetTrack = updatedTracks.find(
                (t) => t.id === targetTrackId
              );
              if (!newTargetTrack) return;
              targetTrack = newTargetTrack;
            }
          }

          if (!targetTrack) return;

          // Check for overlaps with existing elements in target track
          const newElementDuration = mediaItem.duration || 5;
          const mediaSnappedTime = getDropSnappedTime(
            newStartTime,
            newElementDuration
          );
          const newElementEnd = mediaSnappedTime + newElementDuration;

          const hasOverlap = targetTrack.elements.some((existingElement) => {
            const existingStart = existingElement.startTime;
            const existingEnd =
              existingElement.startTime +
              (existingElement.duration -
                existingElement.trimStart -
                existingElement.trimEnd);

            // Check if elements overlap
            return (
              mediaSnappedTime < existingEnd && newElementEnd > existingStart
            );
          });

          if (hasOverlap) {
            toast.error(
              "Cannot place element here - it would overlap with existing elements"
            );
            return;
          }

          addElementToTrack(targetTrackId, {
            type: "media",
            mediaId: mediaItem.id,
            name: mediaItem.name,
            duration: mediaItem.duration || 5,
            startTime: mediaSnappedTime,
            trimStart: 0,
            trimEnd: 0,
          });
        }
      }
    } catch (error) {
      console.error("Error handling drop:", error);
      toast.error("Failed to add media to track");
    }
  };

  return (
    <div
      className="w-full h-full hover:bg-muted/20"
      onClick={(e) => {
        // If clicking empty area (not on an element), deselect all elements
        if (!(e.target as HTMLElement).closest(".timeline-element")) {
          clearSelectedElements();
        }
      }}
      onDragOver={handleTrackDragOver}
      onDragEnter={handleTrackDragEnter}
      onDragLeave={handleTrackDragLeave}
      onDrop={handleTrackDrop}
    >
      <div
        ref={timelineRef}
        className="h-full relative track-elements-container min-w-full"
      >
        {track.elements.length === 0 ? (
          <div
            className={`h-full w-full rounded-sm border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground transition-colors ${
              isDropping
                ? wouldOverlap
                  ? "border-red-500 bg-red-500/10 text-red-600"
                  : "border-blue-500 bg-blue-500/10 text-blue-600"
                : "border-muted/30"
            }`}
          >
            {isDropping
              ? wouldOverlap
                ? "Cannot drop - would overlap"
                : "Drop element here"
              : ""}
          </div>
        ) : (
          <>
            {track.elements.map((element) => {
              const isSelected = selectedElements.some(
                (c) => c.trackId === track.id && c.elementId === element.id
              );

              const handleElementSplit = () => {
                const { currentTime } = usePlaybackStore();
                const { splitElement } = useTimelineStore();
                const splitTime = currentTime;
                const effectiveStart = element.startTime;
                const effectiveEnd =
                  element.startTime +
                  (element.duration - element.trimStart - element.trimEnd);

                if (splitTime > effectiveStart && splitTime < effectiveEnd) {
                  const secondElementId = splitElement(
                    track.id,
                    element.id,
                    splitTime
                  );
                  if (!secondElementId) {
                    toast.error("Failed to split element");
                  }
                } else {
                  toast.error("Playhead must be within element to split");
                }
              };

              const handleElementDuplicate = () => {
                const { addElementToTrack } = useTimelineStore.getState();
                const { id, ...elementWithoutId } = element;
                addElementToTrack(track.id, {
                  ...elementWithoutId,
                  name: element.name + " (copy)",
                  startTime:
                    element.startTime +
                    (element.duration - element.trimStart - element.trimEnd) +
                    0.1,
                });
              };

              const handleElementDelete = () => {
                const { removeElementFromTrack } = useTimelineStore.getState();
                removeElementFromTrack(track.id, element.id);
              };

              return (
                <TimelineElement
                  key={element.id}
                  element={element}
                  track={track}
                  zoomLevel={zoomLevel}
                  isSelected={isSelected}
                  onElementMouseDown={handleElementMouseDown}
                  onElementClick={handleElementClick}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
