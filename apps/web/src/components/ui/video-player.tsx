"use client";

import { useRef, useEffect } from "react";
import { usePlaybackStore } from "@/stores/playback-store";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  clipStartTime: number;
  trimStart: number;
  trimEnd: number;
  clipDuration: number;
  trackMuted?: boolean;
}

export function VideoPlayer({
  src,
  poster,
  className = "",
  clipStartTime,
  trimStart,
  trimEnd,
  clipDuration,
  trackMuted = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isPlaying, currentTime, volume, speed, muted } = usePlaybackStore();

  // Calculate if we're within this clip's timeline range
  const clipEndTime = clipStartTime + (clipDuration - trimStart - trimEnd);
  const isInClipRange =
    currentTime >= clipStartTime && currentTime < clipEndTime;

  // Sync playback events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isInClipRange) return;

    const handleSeekEvent = (e: CustomEvent) => {
      // Always update video time, even if outside clip range
      const timelineTime = e.detail.time;
      const videoTime = Math.max(
        trimStart,
        Math.min(
          clipDuration - trimEnd,
          timelineTime - clipStartTime + trimStart
        )
      );
      video.currentTime = videoTime;
    };

    const handleUpdateEvent = (e: CustomEvent) => {
      // Always update video time, even if outside clip range
      const timelineTime = e.detail.time;
      const targetTime = Math.max(
        trimStart,
        Math.min(
          clipDuration - trimEnd,
          timelineTime - clipStartTime + trimStart
        )
      );

      if (Math.abs(video.currentTime - targetTime) > 0.5) {
        video.currentTime = targetTime;
      }
    };

    const handleSpeed = (e: CustomEvent) => {
      video.playbackRate = e.detail.speed;
    };

    window.addEventListener("playback-seek", handleSeekEvent as EventListener);
    window.addEventListener(
      "playback-update",
      handleUpdateEvent as EventListener
    );
    window.addEventListener("playback-speed", handleSpeed as EventListener);

    return () => {
      window.removeEventListener(
        "playback-seek",
        handleSeekEvent as EventListener
      );
      window.removeEventListener(
        "playback-update",
        handleUpdateEvent as EventListener
      );
      window.removeEventListener(
        "playback-speed",
        handleSpeed as EventListener
      );
    };
  }, [clipStartTime, trimStart, trimEnd, clipDuration, isInClipRange]);

  // Sync playback state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying && isInClipRange) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, isInClipRange]);

  // Sync volume and speed
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = volume;
    video.muted = muted || trackMuted;
    video.playbackRate = speed;
  }, [volume, speed, muted, trackMuted]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className={`max-w-full max-h-full object-contain ${className}`}
      playsInline
      preload="auto"
      controls={false}
      disablePictureInPicture
      disableRemotePlayback
      style={{ pointerEvents: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
