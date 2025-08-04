"use client";

import { cn } from "@/lib/utils";
import { Tab, tabs, useMediaPanelStore } from "./store";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";



export function TabBar() {
  const { activeTab, setActiveTab } = useMediaPanelStore();

  return (
    <div className="flex">
      <div className="h-full px-4 flex flex-col justify-start items-center gap-5 overflow-x-auto scrollbar-x-hidden relative w-full py-4">
        {(Object.keys(tabs) as Tab[]).map((tabKey) => {
          const tab = tabs[tabKey];
          return (
            <div
              className={cn(
                "flex z-[100] flex-col gap-0.5 items-center cursor-pointer",
                activeTab === tabKey ? "text-primary !opacity-100" : "text-muted-foreground"
              )}
              onClick={() => setActiveTab(tabKey)}
              key={tabKey}
            >
              <Tooltip delayDuration={10}>
                <TooltipTrigger asChild>
                  <tab.icon className="size-[1.1rem]! opacity-100 hover:opacity-75" />
                </TooltipTrigger>
                <TooltipContent side="right" align="center" variant="sidebar" sideOffset={8}>
                  <div className="dark:text-base-gray-950 text-black text-sm font-medium leading-none dark:text-white">{tab.label}</div>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
}
