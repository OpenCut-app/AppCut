"use client";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ReactNode, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlaybackStore } from "@/stores/playback-store";

export interface DraggableMediaItemProps {
  name: string;
  preview: ReactNode;
  dragData: Record<string, any>;
  onDragStart?: (e: React.DragEvent) => void;
  onAddToTimeline?: (currentTime: number) => void;
  aspectRatio?: number;
  className?: string;
  showPlusOnDrag?: boolean;
  showLabel?: boolean;
  rounded?: boolean;
  /**
   * media item size
   */
  size?: number;
  variant?: "card" | "compact";
}

export function DraggableMediaItem({
  name,
  preview,
  dragData,
  onDragStart,
  onAddToTimeline,
  aspectRatio = 16 / 9,
  className = "",
  showPlusOnDrag = true,
  showLabel = true,
  rounded = true,
  size,
  variant = "card",
}: DraggableMediaItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  const currentTime = usePlaybackStore((state) => state.currentTime);

  const handleAddToTimeline = () => {
    onAddToTimeline?.(currentTime);
  };

  const emptyImg = new window.Image();
  emptyImg.src =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";

  useEffect(() => {
    if (!isDragging) return;

    const handleDragOver = (e: DragEvent) => {
      setDragPosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener("dragover", handleDragOver);

    return () => {
      document.removeEventListener("dragover", handleDragOver);
    };
  }, [isDragging]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setDragImage(emptyImg, 0, 0);

    // Set drag data
    e.dataTransfer.setData(
      "application/x-media-item",
      JSON.stringify(dragData)
    );
    e.dataTransfer.effectAllowed = "copy";

    // Set initial position and show custom drag preview
    setDragPosition({ x: e.clientX, y: e.clientY });
    setIsDragging(true);

    onDragStart?.(e);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const getMediaTitle = (
    name: string
  ): [fileName: string, extension: string] => {
    const lastDotIndex = name.lastIndexOf(".");
    if (lastDotIndex > 0 && name.length - lastDotIndex <= 5) {
      // Split at the last dot if extension is 4 chars or less
      return [name.substring(0, lastDotIndex), name.substring(lastDotIndex)];
    }
    // No extension or very long extension, return full name
    return [name, ""];
  };

  const [fileName, extension] = getMediaTitle(name);
  return (
    <>
      {variant === "card" ? (
        <div
          ref={dragRef}
          className={cn("relative group", size ? "size-full" : "size-28")}
        >
          <div
            className={`flex flex-col gap-1 p-0 h-auto w-full relative cursor-default ${className}`}
          >
            <AspectRatio
              ratio={aspectRatio}
              className={cn(
                "bg-panel-accent relative overflow-hidden",
                rounded && "rounded-md",
                "[&::-webkit-drag-ghost]:opacity-0" // Webkit-specific ghost hiding
              )}
              draggable={true}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {preview}
              {!isDragging && (
                <PlusButton
                  className="opacity-0 group-hover:opacity-100"
                  onClick={handleAddToTimeline}
                />
              )}
            </AspectRatio>
            {showLabel && (
              <span
                className="text-[0.7rem] text-muted-foreground w-full text-left flex"
                aria-label={name}
                title={name}
              >
                <span className="truncate max-w-full">{fileName}</span>
                {extension && extension}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div ref={dragRef} className="relative group w-full">
          <div
            className={cn(
              "h-10 flex items-center gap-3 cursor-default w-full",
              "[&::-webkit-drag-ghost]:opacity-0",
              className
            )}
            draggable={true}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex-shrink-0 rounded overflow-hidden size-6">
              {preview}
            </div>
            <span className="text-sm truncate flex-1 w-full">{name}</span>
          </div>
        </div>
      )}

      {/* Custom drag preview */}
      {isDragging &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed pointer-events-none z-9999"
            style={{
              left: dragPosition.x - 40, // Center the preview (half of 80px)
              top: dragPosition.y - 40, // Center the preview (half of 80px)
            }}
          >
            <div className="w-[80px]">
              <AspectRatio
                ratio={1}
                className="relative rounded-md overflow-hidden shadow-2xl ring-3 ring-primary"
              >
                <div className="w-full h-full [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:rounded-none">
                  {preview}
                </div>
                {showPlusOnDrag && (
                  <PlusButton
                    onClick={handleAddToTimeline}
                    tooltipText="Add to timeline or drag to position"
                  />
                )}
              </AspectRatio>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function PlusButton({
  className,
  onClick,
  tooltipText,
}: {
  className?: string;
  onClick?: () => void;
  tooltipText?: string;
}) {
  const button = (
    <Button
      size="icon"
      className={cn(
        "absolute bottom-2 right-2 size-4 bg-background text-foreground",
        className
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      title={tooltipText}
    >
      <Plus className="size-3!" />
    </Button>
  );

  if (tooltipText) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
