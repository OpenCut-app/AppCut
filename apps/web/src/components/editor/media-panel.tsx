"use client";

import { useDragDrop } from "@/hooks/use-drag-drop";
import { processMediaFiles } from "@/lib/media-processing";
import { useMediaStore, type MediaItem } from "@/stores/media-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { Image, Music, Plus, Upload, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AspectRatio } from "../ui/aspect-ratio";
import { Button } from "../ui/button";
import { DragOverlay } from "../ui/drag-overlay";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../ui/context-menu";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

// MediaPanel lets users add, view, and drag media (images, videos, audio) into the project.
// You can upload files or drag them from your computer. Dragging from here to the timeline adds them to your video project.

export function MediaPanel() {
  const { mediaItems, addMediaItem, removeMediaItem } = useMediaStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState("all");

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    try {
      // Process files (extract metadata, generate thumbnails, etc.)
      const processedItems = await processMediaFiles(files, (p) =>
        setProgress(p)
      );
      // Add each processed media item to the store
      for (const item of processedItems) {
        await addMediaItem(item);
      }
    } catch (error) {
      // Show error toast if processing fails
      console.error("Error processing files:", error);
      toast.error("Failed to process files");
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const { isDragOver, dragProps } = useDragDrop({
    // When files are dropped, process them
    onDrop: processFiles,
  });

  const handleFileSelect = () => fileInputRef.current?.click(); // Open file picker

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // When files are selected via file picker, process them
    if (e.target.files) processFiles(e.target.files);
    e.target.value = ""; // Reset input
  };

  const handleRemove = async (e: React.MouseEvent, id: string) => {
    // Remove a media item from the store
    e.stopPropagation();

    // Remove tracks automatically when delete media
    const { tracks, removeTrack } = useTimelineStore.getState();
    tracks.forEach((track) => {
      const clipsToRemove = track.clips.filter((clip) => clip.mediaId === id);
      clipsToRemove.forEach((clip) => {
        useTimelineStore.getState().removeClipFromTrack(track.id, clip.id);
      });
      // Only remove track if it becomes empty and has no other clips
      const updatedTrack = useTimelineStore
        .getState()
        .tracks.find((t) => t.id === track.id);
      if (updatedTrack && updatedTrack.clips.length === 0) {
        removeTrack(track.id);
      }
    });
    await removeMediaItem(id);
  };

  const formatDuration = (duration: number) => {
    // Format seconds as mm:ss
    const min = Math.floor(duration / 60);
    const sec = Math.floor(duration % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const startDrag = (e: React.DragEvent, item: MediaItem) => {
    // When dragging a media item, set drag data for timeline to read
    e.dataTransfer.setData(
      "application/x-media-item",
      JSON.stringify({
        id: item.id,
        type: item.type,
        name: item.name,
      })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const [filteredMediaItems, setFilteredMediaItems] = useState(mediaItems);

  useEffect(() => {
    const filtered = mediaItems.filter((item) => {
      if (mediaFilter && mediaFilter !== "all" && item.type !== mediaFilter) {
        return false;
      }

      if (
        searchQuery &&
        !item.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      return true;
    });

    setFilteredMediaItems(filtered);
  }, [mediaItems, mediaFilter, searchQuery]);

  const renderPreview = (item: MediaItem) => {
    // Render a preview for each media type (image, video, audio, unknown)
    // Each preview is draggable to the timeline
    const baseDragProps = {
      draggable: true,
      onDragStart: (e: React.DragEvent) => startDrag(e, item),
    };

    if (item.type === "image") {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <img
            src={item.url}
            alt={item.name}
            className="max-w-full max-h-full object-contain rounded"
            loading="lazy"
            {...baseDragProps}
          />
        </div>
      );
    }

    if (item.type === "video") {
      if (item.thumbnailUrl) {
        return (
          <div className="relative w-full h-full" {...baseDragProps}>
            <img
              src={item.thumbnailUrl}
              alt={item.name}
              className="w-full h-full object-cover rounded"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded">
              <Video className="h-6 w-6 text-white drop-shadow-md" />
            </div>
            {item.duration && (
              <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                {formatDuration(item.duration)}
              </div>
            )}
          </div>
        );
      }
      return (
        <div
          className="w-full h-full bg-muted/30 flex flex-col items-center justify-center text-muted-foreground rounded"
          {...baseDragProps}
        >
          <Video className="h-6 w-6 mb-1" />
          <span className="text-xs">Video</span>
          {item.duration && (
            <span className="text-xs opacity-70">
              {formatDuration(item.duration)}
            </span>
          )}
        </div>
      );
    }

    if (item.type === "audio") {
      return (
        <div
          className="w-full h-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex flex-col items-center justify-center text-muted-foreground rounded border border-green-500/20"
          {...baseDragProps}
        >
          <Music className="h-6 w-6 mb-1" />
          <span className="text-xs">Audio</span>
          {item.duration && (
            <span className="text-xs opacity-70">
              {formatDuration(item.duration)}
            </span>
          )}
        </div>
      );
    }

    return (
      <div
        className="w-full h-full bg-muted/30 flex flex-col items-center justify-center text-muted-foreground rounded"
        {...baseDragProps}
      >
        <Image className="h-6 w-6" />
        <span className="text-xs mt-1">Unknown</span>
      </div>
    );
  };

  return (
    <>
      {/* Hidden file input for uploading media */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        className={`h-full flex flex-col transition-colors relative ${isDragOver ? "bg-accent/30" : ""}`}
        {...dragProps}
      >
        {/* Show overlay when dragging files over the panel */}
        <DragOverlay isVisible={isDragOver} />

        <div className="p-2 border-b">
          {/* Button to add/upload media */}
          <div className="flex gap-2">
            {/* Search and filter controls */}
            <Select value={mediaFilter} onValueChange={setMediaFilter}>
              <SelectTrigger className="w-[80px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="image">Image</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="text"
              placeholder="Search media..."
              className="min-w-[60px] flex-1 h-7 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Add media button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleFileSelect}
              disabled={isProcessing}
              className="flex-none min-w-[30px] whitespace-nowrap overflow-hidden px-2 justify-center items-center"
            >
              {isProcessing ? (
                <>
                  <Upload className="h-4 w-4 animate-spin" />
                  <span className="hidden md:inline ml-2">{progress}%</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2" aria-label="Add file">
                    Add
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {/* Show message if no media, otherwise show media grid */}
          {filteredMediaItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center h-full">
              <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <Image className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No media in project
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Drag files here or use the button above
              </p>
            </div>
          ) : (
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: "repeat(auto-fill, 160px)",
              }}
            >
              {/* Render each media item as a draggable button */}
              {filteredMediaItems.map((item) => (
                <div key={item.id} className="relative group">
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex flex-col gap-1 p-2 h-auto w-full relative border-none !bg-transparent cursor-default"
                      >
                        <AspectRatio ratio={16 / 9} className="bg-accent">
                          {renderPreview(item)}
                        </AspectRatio>
                        <span
                          className="text-[0.7rem] text-muted-foreground truncate w-full text-left"
                          aria-label={item.name}
                          title={item.name}
                        >
                          {item.name.length > 8
                            ? `${item.name.slice(0, 4)}...${item.name.slice(-3)}`
                            : item.name}
                        </span>
                      </Button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem>Export clips</ContextMenuItem>
                      <ContextMenuItem
                        variant="destructive"
                        onClick={(e) => handleRemove(e, item.id)}
                      >
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
