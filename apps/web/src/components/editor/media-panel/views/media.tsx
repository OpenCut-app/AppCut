"use client";

import { useDragDrop } from "@/hooks/use-drag-drop";
import { processMediaFiles } from "@/lib/media-processing";
import { useMediaStore, type MediaItem } from "@/stores/media-store";
import {
  ArrowDown01,
  CloudUpload,
  Grid2X2,
  Image,
  List,
  Loader2,
  Music,
  Search,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MediaDragOverlay } from "@/components/editor/media-panel/drag-overlay";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DraggableMediaItem } from "@/components/ui/draggable-item";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePanelStore } from "@/stores/panel-store";
import { MediaSkeletons } from "@/components/media-skeletons";

function MediaItemWithContextMenu({
  item,
  children,
  onRemove,
}: {
  item: MediaItem;
  children: React.ReactNode;
  onRemove: (e: React.MouseEvent, id: string) => Promise<void>;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Export clips</ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onClick={(e) => onRemove(e, item.id)}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function MediaView() {
  const {
    mediaItems,
    addMediaItem,
    removeMediaItem,
    isLoading,
    initialMediaCount,
  } = useMediaStore();
  const { activeProject } = useProjectStore();
  const { mediaViewMode, setMediaViewMode } = usePanelStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "type" | "duration" | "size">(
    "name"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    if (!activeProject) {
      toast.error("No active project");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    try {
      // Process files (extract metadata, generate thumbnails, etc.)
      const processedItems = await processMediaFiles(files, (p) =>
        setProgress(p)
      );
      // Add each processed media item to the store
      for (const item of processedItems) {
        await addMediaItem(activeProject.id, item);
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

    if (!activeProject) {
      toast.error("No active project");
      return;
    }

    // Media store now handles cascade deletion automatically
    await removeMediaItem(activeProject.id, id);
  };

  const formatDuration = (duration: number) => {
    // Format seconds as mm:ss
    const min = Math.floor(duration / 60);
    const sec = Math.floor(duration % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
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

    filtered.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sortBy) {
        case "name":
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case "type":
          valueA = a.type;
          valueB = b.type;
          break;
        case "duration":
          valueA = a.duration || 0;
          valueB = b.duration || 0;
          break;
        case "size":
          valueA = a.file.size;
          valueB = b.file.size;
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return sortOrder === "asc" ? -1 : 1;
      if (valueA > valueB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredMediaItems(filtered);
  }, [mediaItems, mediaFilter, searchQuery, sortBy, sortOrder]);

  const previewComponents = useMemo(() => {
    const previews = new Map<string, React.ReactNode>();

    filteredMediaItems.forEach((item) => {
      let preview: React.ReactNode;

      if (item.type === "image") {
        preview = (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={item.url}
              alt={item.name}
              className="max-w-full max-h-full object-contain"
              loading="lazy"
            />
          </div>
        );
      } else if (item.type === "video") {
        if (item.thumbnailUrl) {
          preview = (
            <div className="relative w-full h-full">
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
        } else {
          preview = (
            <div className="w-full h-full bg-muted/30 flex flex-col items-center justify-center text-muted-foreground rounded">
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
      } else if (item.type === "audio") {
        preview = (
          <div className="w-full h-full bg-linear-to-br from-green-500/20 to-emerald-500/20 flex flex-col items-center justify-center text-muted-foreground rounded border border-green-500/20">
            <Music className="h-6 w-6 mb-1" />
            <span className="text-xs">Audio</span>
            {item.duration && (
              <span className="text-xs opacity-70">
                {formatDuration(item.duration)}
              </span>
            )}
          </div>
        );
      } else {
        preview = (
          <div className="w-full h-full bg-muted/30 flex flex-col items-center justify-center text-muted-foreground rounded">
            <Image className="h-6 w-6" />
            <span className="text-xs mt-1">Unknown</span>
          </div>
        );
      }

      previews.set(item.id, preview);
    });

    return previews;
  }, [filteredMediaItems]);

  const renderPreview = (item: MediaItem) => previewComponents.get(item.id);

  if (isLoading) {
    return <MediaSkeletons count={initialMediaCount} view={mediaViewMode} />;
  }

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
        className={`h-full flex flex-col gap-1 transition-colors relative ${isDragOver ? "bg-accent/30" : ""}`}
        {...dragProps}
      >
        <div className="p-3 pb-2 bg-panel">
          {/* Search and filter controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={handleFileSelect}
              disabled={isProcessing}
              className="!bg-background px-4 flex-1 justify-center items-center h-9 opacity-100 hover:opacity-75 transition-opacity"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              <span>Upload</span>
            </Button>
            <div className="flex items-center gap-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="text"
                      onClick={() =>
                        setMediaViewMode(
                          mediaViewMode === "grid" ? "list" : "grid"
                        )
                      }
                      disabled={isProcessing}
                      className="justify-center items-center"
                    >
                      {mediaViewMode === "grid" ? (
                        <List strokeWidth={1.5} className="!size-[1.05rem]" />
                      ) : (
                        <Grid2X2
                          strokeWidth={1.5}
                          className="!size-[1.05rem]"
                        />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {mediaViewMode === "grid"
                        ? "Switch to list view"
                        : "Switch to grid view"}
                    </p>
                  </TooltipContent>
                  <Tooltip>
                    <DropdownMenu>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="text"
                            disabled={isProcessing}
                            className="justify-center items-center"
                          >
                            <ArrowDown01
                              strokeWidth={1.5}
                              className="!size-[1.05rem]"
                            />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            if (sortBy === "name") {
                              setSortOrder(
                                sortOrder === "asc" ? "desc" : "asc"
                              );
                            } else {
                              setSortBy("name");
                              setSortOrder("asc");
                            }
                          }}
                        >
                          Name{" "}
                          {sortBy === "name" &&
                            (sortOrder === "asc" ? "↑" : "↓")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (sortBy === "type") {
                              setSortOrder(
                                sortOrder === "asc" ? "desc" : "asc"
                              );
                            } else {
                              setSortBy("type");
                              setSortOrder("asc");
                            }
                          }}
                        >
                          Type{" "}
                          {sortBy === "type" &&
                            (sortOrder === "asc" ? "↑" : "↓")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (sortBy === "duration") {
                              setSortOrder(
                                sortOrder === "asc" ? "desc" : "asc"
                              );
                            } else {
                              setSortBy("duration");
                              setSortOrder("asc");
                            }
                          }}
                        >
                          Duration{" "}
                          {sortBy === "duration" &&
                            (sortOrder === "asc" ? "↑" : "↓")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (sortBy === "size") {
                              setSortOrder(
                                sortOrder === "asc" ? "desc" : "asc"
                              );
                            } else {
                              setSortBy("size");
                              setSortOrder("asc");
                            }
                          }}
                        >
                          File Size{" "}
                          {sortBy === "size" &&
                            (sortOrder === "asc" ? "↑" : "↓")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <TooltipContent>
                      <p>
                        Sort by {sortBy} (
                        {sortOrder === "asc" ? "ascending" : "descending"})
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        <div className="h-full w-full overflow-y-auto scrollbar-thin">
          <div className="flex-1 p-3 pt-0 w-full">
            {isDragOver || filteredMediaItems.length === 0 ? (
              <MediaDragOverlay
                isVisible={true}
                isProcessing={isProcessing}
                progress={progress}
                onClick={handleFileSelect}
                isEmptyState={filteredMediaItems.length === 0 && !isDragOver}
              />
            ) : mediaViewMode === "grid" ? (
              <GridView
                filteredMediaItems={filteredMediaItems}
                renderPreview={renderPreview}
                handleRemove={handleRemove}
              />
            ) : (
              <ListView
                filteredMediaItems={filteredMediaItems}
                renderPreview={renderPreview}
                handleRemove={handleRemove}
                formatDuration={formatDuration}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function GridView({
  filteredMediaItems,
  renderPreview,
  handleRemove,
}: {
  filteredMediaItems: MediaItem[];
  renderPreview: (item: MediaItem) => React.ReactNode;
  handleRemove: (e: React.MouseEvent, id: string) => Promise<void>;
}) {
  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateColumns: "repeat(auto-fill, 160px)",
      }}
    >
      {filteredMediaItems.map((item) => (
        <MediaItemWithContextMenu
          key={item.id}
          item={item}
          onRemove={handleRemove}
        >
          <DraggableMediaItem
            name={item.name}
            preview={renderPreview(item)}
            dragData={{
              id: item.id,
              type: item.type,
              name: item.name,
            }}
            showPlusOnDrag={false}
            onAddToTimeline={(currentTime) =>
              useTimelineStore.getState().addMediaAtTime(item, currentTime)
            }
            rounded={false}
            variant="card"
          />
        </MediaItemWithContextMenu>
      ))}
    </div>
  );
}

function ListView({
  filteredMediaItems,
  renderPreview,
  handleRemove,
  formatDuration,
}: {
  filteredMediaItems: MediaItem[];
  renderPreview: (item: MediaItem) => React.ReactNode;
  handleRemove: (e: React.MouseEvent, id: string) => Promise<void>;
  formatDuration: (duration: number) => string;
}) {
  return (
    <div className="space-y-1">
      {filteredMediaItems.map((item) => (
        <MediaItemWithContextMenu
          key={item.id}
          item={item}
          onRemove={handleRemove}
        >
          <DraggableMediaItem
            name={item.name}
            preview={renderPreview(item)}
            dragData={{
              id: item.id,
              type: item.type,
              name: item.name,
            }}
            showPlusOnDrag={false}
            onAddToTimeline={(currentTime) =>
              useTimelineStore.getState().addMediaAtTime(item, currentTime)
            }
            variant="compact"
          />
        </MediaItemWithContextMenu>
      ))}
    </div>
  );
}
