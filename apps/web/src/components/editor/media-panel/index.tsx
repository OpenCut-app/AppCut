"use client";

import { TabBar } from "./tabbar";
import { MediaView } from "./views/media";
import { useMediaPanelStore, Tab } from "./store";
import { TextView } from "./views/text";
import { StickerView } from "./views/stickers";
import { AudioView } from "./views/audio";
import { SoundsView } from "./views/sounds";
import { Separator } from "@/components/ui/separator";
import { SettingsView } from "./views/settings";

export function MediaPanel() {
  const { activeTab } = useMediaPanelStore();

  const viewMap: Record<Tab, React.ReactNode> = {
    media: <MediaView />,
    audio: (
      <div className="p-4 text-muted-foreground">Audio view coming soon...</div>
     ),
    sounds: <SoundsView />,
    text: <TextView />,
    stickers: <StickerView />,
    effects: (
      <div className="p-4 text-muted-foreground">
        Effects view coming soon...
      </div>
    ),
    transitions: (
      <div className="p-4 text-muted-foreground">
        Transitions view coming soon...
      </div>
    ),
    captions: (
      <div className="p-4 text-muted-foreground">
        Captions view coming soon...
      </div>
    ),
    filters: (
      <div className="p-4 text-muted-foreground">
        Filters view coming soon...
      </div>
    ),
    adjustment: (
      <div className="p-4 text-muted-foreground">
        Adjustment view coming soon...
      </div>
    ),
    settings: <SettingsView />,
  };

  return (
    <div className="h-full flex bg-panel">
      <TabBar />
      <Separator orientation="vertical" />
      <div className="flex-1 overflow-hidden">{viewMap[activeTab]}</div>
    </div>
  );
}
