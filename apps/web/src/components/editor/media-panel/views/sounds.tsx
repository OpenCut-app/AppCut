"use client";

import { Input } from "@/components/ui/input";
import { useState, useMemo, useRef, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlayIcon,
  PauseIcon,
  HeartIcon,
  PlusIcon,
  ListFilter,
} from "lucide-react";
import { useSoundsStore } from "@/stores/sounds-store";
import { useSoundSearch } from "@/hooks/use-sound-search";
import type { SoundEffect, SavedSound } from "@/types/sounds";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TTSView } from "./tts";

export function SoundsView() {
  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="sound-effects" className="flex flex-col h-full">
        <div className="px-3 pt-4 pb-0 overflow-hidden">
          <div className="overflow-x-auto scrollbar-none">
            <TabsList className="w-max">
              <TabsTrigger value="sound-effects">Sound effects</TabsTrigger>
              <TabsTrigger value="songs">Songs</TabsTrigger>
              <TabsTrigger value="tts">TTS</TabsTrigger>
              <TabsTrigger value="saved">Saved</TabsTrigger>
            </TabsList>
          </div>
        </div>
        <Separator className="my-4" />
        <TabsContent
          value="sound-effects"
          className="p-5 pt-0 mt-0 flex-1 flex flex-col min-h-0"
        >
          <SoundEffectsView />
        </TabsContent>
        <TabsContent
          value="tts"
          className="pt-0 mt-0 flex-1 flex flex-col min-h-0"
        >
          <TTSView />
        </TabsContent>
        <TabsContent
          value="saved"
          className="p-5 pt-0 mt-0 flex-1 flex flex-col min-h-0"
        >
          <SavedSoundsView />
        </TabsContent>
        <TabsContent
          value="songs"
          className="p-5 pt-0 mt-0 flex-1 flex flex-col min-h-0"
        >
          <SongsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SoundEffectsView() {
  const {
    topSoundEffects,
    isLoading,
    searchQuery,
    setSearchQuery,
    scrollPosition,
    setScrollPosition,
    loadSavedSounds,
    isSoundSaved,
    toggleSavedSound,
    showCommercialOnly,
    toggleCommercialFilter,
  } = useSoundsStore();
  const {
    results: searchResults,
    isLoading: isSearching,
    loadMore,
    hasNextPage,
    isLoadingMore,
  } = useSoundSearch(searchQuery, showCommercialOnly);

  // Audio playback state
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );

  // Scroll position persistence
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Load saved sounds and restore scroll position when component mounts
  useEffect(() => {
    loadSavedSounds();

    if (scrollAreaRef.current && scrollPosition > 0) {
      const timeoutId = setTimeout(() => {
        scrollAreaRef.current?.scrollTo({ top: scrollPosition });
      }, 100); // Small delay to ensure content is rendered

      return () => clearTimeout(timeoutId);
    }
  }, []); // Only run on mount

  // Track scroll position changes and handle infinite scroll
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    setScrollPosition(scrollTop);

    // Trigger loadMore when scrolled to within 200px of bottom
    const nearBottom = scrollTop + clientHeight >= scrollHeight - 200;
    if (nearBottom && hasNextPage && !isLoadingMore && !isSearching) {
      loadMore();
    }
  };

  // Use your existing design, just swap the data source
  const displayedSounds = useMemo(() => {
    const sounds = searchQuery ? searchResults : topSoundEffects;
    return sounds;
  }, [searchQuery, searchResults, topSoundEffects]);

  const playSound = (sound: SoundEffect) => {
    if (playingId === sound.id) {
      audioElement?.pause();
      setPlayingId(null);
      return;
    }

    // Stop previous sound
    audioElement?.pause();

    if (sound.previewUrl) {
      const audio = new Audio(sound.previewUrl);
      audio.addEventListener("ended", () => {
        setPlayingId(null);
      });
      audio.addEventListener("error", (e) => {
        setPlayingId(null);
      });
      audio.play().catch((error) => {
        setPlayingId(null);
      });

      setAudioElement(audio);
      setPlayingId(sound.id);
    }
  };

  return (
    <div className="flex flex-col gap-5 mt-1 h-full">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search sound effects"
          className="bg-panel-accent w-full"
          containerClassName="w-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          showClearIcon
          onClear={() => setSearchQuery("")}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="text"
              size="icon"
              className={cn(showCommercialOnly && "text-primary")}
            >
              <ListFilter className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuCheckboxItem
              checked={showCommercialOnly}
              onCheckedChange={toggleCommercialFilter}
            >
              Show only commercially licensed
            </DropdownMenuCheckboxItem>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {showCommercialOnly
                ? "Only showing sounds licensed for commercial use"
                : "Showing all sounds regardless of license"}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative h-full overflow-hidden">
        <ScrollArea
          className="flex-1 h-full"
          ref={scrollAreaRef}
          onScrollCapture={handleScroll}
        >
          <div className="flex flex-col gap-4">
            {isLoading && !searchQuery && (
              <div className="text-muted-foreground text-sm">
                Loading sounds...
              </div>
            )}
            {isSearching && searchQuery && (
              <div className="text-muted-foreground text-sm">Searching...</div>
            )}
            {displayedSounds.map((sound) => (
              <AudioItem
                key={sound.id}
                sound={sound}
                isPlaying={playingId === sound.id}
                onPlay={() => playSound(sound)}
                isSaved={isSoundSaved(sound.id)}
                onToggleSaved={() => toggleSavedSound(sound)}
              />
            ))}
            {!isLoading && !isSearching && displayedSounds.length === 0 && (
              <div className="text-muted-foreground text-sm">
                {searchQuery ? "No sounds found" : "No sounds available"}
              </div>
            )}
            {isLoadingMore && (
              <div className="text-muted-foreground text-sm text-center py-4">
                Loading more sounds...
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function SavedSoundsView() {
  const {
    savedSounds,
    isLoadingSavedSounds,
    savedSoundsError,
    loadSavedSounds,
    isSoundSaved,
    toggleSavedSound,
    clearSavedSounds,
  } = useSoundsStore();

  // Audio playback state
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );

  // Clear confirmation dialog state
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Load saved sounds when tab becomes active
  useEffect(() => {
    loadSavedSounds();
  }, [loadSavedSounds]);

  const playSound = (sound: SavedSound) => {
    if (playingId === sound.id) {
      audioElement?.pause();
      setPlayingId(null);
      return;
    }

    // Stop previous sound
    audioElement?.pause();

    if (sound.previewUrl) {
      const audio = new Audio(sound.previewUrl);
      audio.addEventListener("ended", () => {
        setPlayingId(null);
      });
      audio.addEventListener("error", (e) => {
        setPlayingId(null);
      });
      audio.play().catch((error) => {
        setPlayingId(null);
      });

      setAudioElement(audio);
      setPlayingId(sound.id);
    }
  };

  // Convert SavedSound to SoundEffect for compatibility with AudioItem
  const convertToSoundEffect = (savedSound: SavedSound): SoundEffect => ({
    id: savedSound.id,
    name: savedSound.name,
    description: "",
    url: "",
    previewUrl: savedSound.previewUrl,
    downloadUrl: savedSound.downloadUrl,
    duration: savedSound.duration,
    filesize: 0,
    type: "audio",
    channels: 0,
    bitrate: 0,
    bitdepth: 0,
    samplerate: 0,
    username: savedSound.username,
    tags: savedSound.tags,
    license: savedSound.license,
    created: savedSound.savedAt,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
  });

  if (isLoadingSavedSounds) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground text-sm">
          Loading saved sounds...
        </div>
      </div>
    );
  }

  if (savedSoundsError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-destructive text-sm">
          Error: {savedSoundsError}
        </div>
      </div>
    );
  }

  if (savedSounds.length === 0) {
    return (
      <div className="bg-panel h-full p-4 flex flex-col items-center justify-center gap-3">
        <HeartIcon
          className="w-10 h-10 text-muted-foreground"
          strokeWidth={1.5}
        />
        <div className="flex flex-col gap-2 text-center">
          <p className="text-lg font-medium">No saved sounds</p>
          <p className="text-sm text-muted-foreground text-balance">
            Click the heart icon on any sound to save it here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 mt-1 h-full">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {savedSounds.length} saved{" "}
          {savedSounds.length === 1 ? "sound" : "sounds"}
        </p>
        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogTrigger asChild>
            <Button
              variant="text"
              size="sm"
              className="h-auto text-muted-foreground hover:text-destructive !opacity-100"
            >
              Clear all
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear all saved sounds?</DialogTitle>
              <DialogDescription>
                This will permanently remove all {savedSounds.length} saved
                sounds from your collection. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="text" onClick={() => setShowClearDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await clearSavedSounds();
                  setShowClearDialog(false);
                }}
              >
                Clear all sounds
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative h-full overflow-hidden">
        <ScrollArea className="flex-1 h-full">
          <div className="flex flex-col gap-4">
            {savedSounds.map((sound) => (
              <AudioItem
                key={sound.id}
                sound={convertToSoundEffect(sound)}
                isPlaying={playingId === sound.id}
                onPlay={() => playSound(sound)}
                isSaved={isSoundSaved(sound.id)}
                onToggleSaved={() =>
                  toggleSavedSound(convertToSoundEffect(sound))
                }
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function SongsView() {
  return <div>Songs</div>;
}

interface AudioItemProps {
  sound: SoundEffect;
  isPlaying: boolean;
  onPlay: () => void;
  isSaved: boolean;
  onToggleSaved: () => void;
}

function AudioItem({
  sound,
  isPlaying,
  onPlay,
  isSaved,
  onToggleSaved,
}: AudioItemProps) {
  const { addSoundToTimeline } = useSoundsStore();

  const handleClick = () => {
    onPlay();
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSaved();
  };

  const handleAddToTimeline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await addSoundToTimeline(sound);
  };

  return (
    <div
      className="group flex items-center gap-3 opacity-100 hover:opacity-75 transition-opacity cursor-pointer"
      onClick={handleClick}
    >
      <div className="relative w-12 h-12 bg-accent rounded-md flex items-center justify-center overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
        {isPlaying ? (
          <PauseIcon className="w-5 h-5" />
        ) : (
          <PlayIcon className="w-5 h-5" />
        )}
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="font-medium truncate text-sm">{sound.name}</p>
        <span className="text-xs text-muted-foreground truncate block">
          {sound.username}
        </span>
      </div>

      <div className="flex items-center gap-3 pr-2">
        <Button
          variant="text"
          size="icon"
          className="text-muted-foreground hover:text-foreground !opacity-100 w-auto"
          onClick={handleAddToTimeline}
          title="Add to timeline"
        >
          <PlusIcon className="w-4 h-4" />
        </Button>
        <Button
          variant="text"
          size="icon"
          className={`hover:text-foreground !opacity-100 w-auto ${
            isSaved
              ? "text-red-500 hover:text-red-600"
              : "text-muted-foreground"
          }`}
          onClick={handleSaveClick}
          title={isSaved ? "Remove from saved" : "Save sound"}
        >
          <HeartIcon className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
