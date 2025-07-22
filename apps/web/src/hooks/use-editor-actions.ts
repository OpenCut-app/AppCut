"use client";

import { useEffect } from "react";
import { useActionHandler } from "@/constants/actions";
import { useTimelineStore } from "@/stores/timeline-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { useProjectStore } from "@/stores/project-store";
import { toast } from "sonner";

export function useEditorActions() {
  const {
    tracks,
    selectedElements,
    clearSelectedElements,
    setSelectedElements,
    removeElementFromTrack,
    splitElement,
    separateAudio,
    addElementToTrack,
    snappingEnabled,
    toggleSnapping,
    undo,
    redo,
  } = useTimelineStore();

  const { currentTime, duration, isPlaying, toggle, seek } = usePlaybackStore();
  const { activeProject } = useProjectStore();

  // Playback actions
  useActionHandler("toggle-play", () => {
    toggle();
  });

  useActionHandler("stop-playback", () => {
    if (isPlaying) {
      toggle();
    }
    seek(0);
  });

  useActionHandler("seek-forward", (args) => {
    const seconds = args?.seconds ?? 1;
    seek(Math.min(duration, currentTime + seconds));
  });

  useActionHandler("seek-backward", (args) => {
    const seconds = args?.seconds ?? 1;
    seek(Math.max(0, currentTime - seconds));
  });

  useActionHandler("frame-step-forward", () => {
    const projectFps = activeProject?.fps || 30;
    seek(Math.min(duration, currentTime + 1 / projectFps));
  });

  useActionHandler("frame-step-backward", () => {
    const projectFps = activeProject?.fps || 30;
    seek(Math.max(0, currentTime - 1 / projectFps));
  });

  useActionHandler("jump-forward", (args) => {
    const seconds = args?.seconds ?? 5;
    seek(Math.min(duration, currentTime + seconds));
  });

  useActionHandler("jump-backward", (args) => {
    const seconds = args?.seconds ?? 5;
    seek(Math.max(0, currentTime - seconds));
  });

  useActionHandler("goto-start", () => {
    seek(0);
  });

  useActionHandler("goto-end", () => {
    seek(duration);
  });

  // Timeline editing actions
  useActionHandler("split-element", () => {
    if (selectedElements.length !== 1) {
      toast.error("Select exactly one element to split");
      return;
    }

    const { trackId, elementId } = selectedElements[0];
    const track = tracks.find((t: any) => t.id === trackId);
    const element = track?.elements.find((el: any) => el.id === elementId);

    if (element) {
      const effectiveStart = element.startTime;
      const effectiveEnd =
        element.startTime +
        (element.duration - element.trimStart - element.trimEnd);

      if (currentTime > effectiveStart && currentTime < effectiveEnd) {
        splitElement(trackId, elementId, currentTime);
      } else {
        toast.error("Playhead must be within selected element");
      }
    }
  });

  useActionHandler("delete-selected", () => {
    if (selectedElements.length === 0) {
      return;
    }
    selectedElements.forEach(
      ({ trackId, elementId }: { trackId: string; elementId: string }) => {
        removeElementFromTrack(trackId, elementId);
      }
    );
    clearSelectedElements();
  });

  useActionHandler("select-all", () => {
    const allElements = tracks.flatMap((track: any) =>
      track.elements.map((element: any) => ({
        trackId: track.id,
        elementId: element.id,
      }))
    );
    setSelectedElements(allElements);
  });

  useActionHandler("duplicate-selected", () => {
    if (selectedElements.length !== 1) {
      toast.error("Select exactly one element to duplicate");
      return;
    }

    const { trackId, elementId } = selectedElements[0];
    const track = tracks.find((t: any) => t.id === trackId);
    const element = track?.elements.find((el: any) => el.id === elementId);

    if (element) {
      const newStartTime =
        element.startTime +
        (element.duration - element.trimStart - element.trimEnd) +
        0.1;
      const { id, ...elementWithoutId } = element;

      addElementToTrack(trackId, {
        ...elementWithoutId,
        startTime: newStartTime,
      });
    }
  });

  useActionHandler("separate-audio", () => {
    if (selectedElements.length !== 1) {
      toast.error("Select exactly one media element to separate audio");
      return;
    }
    const { trackId, elementId } = selectedElements[0];
    const track = tracks.find((t) => t.id === trackId);
    if (!track || track.type !== "media") {
      toast.error("Select a media element to separate audio");
      return;
    }
    separateAudio(trackId, elementId);
  });

  useActionHandler("toggle-snapping", () => {
    toggleSnapping();
  });

  // History actions
  useActionHandler("undo", () => {
    undo();
  });

  useActionHandler("redo", () => {
    redo();
  });
}
