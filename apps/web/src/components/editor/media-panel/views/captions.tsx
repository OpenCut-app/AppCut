"use client";

import { useState, useEffect } from "react";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  DownloadIcon,
  PlusIcon,
  MicIcon,
  AlertTriangleIcon,
  TrashIcon,
  EyeIcon,
  RefreshCwIcon,
  X,
} from "lucide-react";

import { useSpeechToTextStore } from "@/stores/speech-to-text-store";

import { Badge } from "@/components/ui/badge";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Captions() {
  const [textInsertMode, setTextInsertMode] = useState<'sentences' | 'words'>('sentences');
  const [viewingSegments, setViewingSegments] = useState<string | null>(null);
  
  const {
    deviceCapabilities,
    availableModels,
    selectedModel,
    processingStatus,
    results,
    isWorkerInitialized,
    loadDeviceCapabilities,
    initializeWorker,
    setSelectedModel,
    processSelectedElement,
    clearResults,
    removeResult,
    insertResultToTimeline,
    downloadSRT,
    getSelectedElementInfo,
  } = useSpeechToTextStore();

  // Load capabilities on mount
  useEffect(() => {
    loadDeviceCapabilities();
  }, [loadDeviceCapabilities]);

  // Get current selected element info
  const selectedElementInfo = getSelectedElementInfo();

  const handleInitialize = async () => {
    try {
      await initializeWorker();
    } catch (error) {
      console.error('Failed to initialize:', error);
    }
  };

  const handleProcess = async () => {
    // Close segment viewer when processing new transcription
    setViewingSegments(null);
    
    if (!selectedElementInfo) {
      return;
    }
    
    try {
      await processSelectedElement();
    } catch (error) {
      console.error('Failed to process:', error);
    }
  };
  return (
    <ScrollArea className="h-full">
      <div className="p-5 pt-4 flex flex-col gap-5 mt-1">
        <div className="space-y-2">
          <label className="text-sm font-medium">AI Model</label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="bg-panel-accent w-full">
              <SelectValue placeholder="Select AI model" />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model.name} value={model.name}>
                  <div className="flex items-center gap-2 w-full">
                    <span className="font-medium flex-1">{model.name.split('/')[1]}</span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {model.size}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {deviceCapabilities && (
            <div className="flex justify-center mt-2">
              <Badge variant={deviceCapabilities.hasWebGPU ? "default" : "secondary"} className="text-xs">
                {deviceCapabilities.hasWebGPU ? "WebGPU Available" : "WASM Fallback"}
              </Badge>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Selected Element</label>
          {selectedElementInfo ? (
            <div className="bg-panel-accent rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm" title={selectedElementInfo.element.name || 'Unnamed Element'}>
                  {(selectedElementInfo.element.name || 'Unnamed Element').length > 20 
                    ? `${(selectedElementInfo.element.name || 'Unnamed Element').slice(0, 20)}...` 
                    : (selectedElementInfo.element.name || 'Unnamed Element')
                  }
                </span>
                <Badge variant="outline" className="text-xs">
                  {selectedElementInfo.mediaItem.type}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Track: {selectedElementInfo.track.name}</div>
                <div>Duration: {(selectedElementInfo.element.duration - (selectedElementInfo.element.trimStart || 0) - (selectedElementInfo.element.trimEnd || 0)).toFixed(2)}s</div>
                <div>Timeline Position: {selectedElementInfo.element.startTime.toFixed(2)}s</div>
              </div>
            </div>
          ) : (
            <div className="bg-panel-accent rounded-md p-3 text-center text-muted-foreground text-sm">
              Select an audio or video element in the timeline to generate captions
            </div>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Text Insertion Mode</label>
          <RadioGroup value={textInsertMode} onValueChange={(value: 'sentences' | 'words') => setTextInsertMode(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="sentences" id="sentences" />
              <Label htmlFor="sentences" className="text-sm">Sentences (chunks)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="words" id="words" />
              <Label htmlFor="words" className="text-sm">Individual words</Label>
            </div>
          </RadioGroup>
        </div>

        {deviceCapabilities?.warnings && deviceCapabilities.warnings.length > 0 && (
          <Alert>
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertDescription>
              {deviceCapabilities.warnings[0]}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={async () => {
                  if (!selectedElementInfo) {
                    return;
                  }
                  
                  try {
                    // Always ensure worker is initialized first
                    if (!isWorkerInitialized) {
                      await handleInitialize();
                      
                      // Wait for the worker to actually be initialized
                      // We'll poll the store state until isWorkerInitialized becomes true
                      let retries = 0;
                      const maxRetries = 50; // 5 seconds max wait
                      while (!useSpeechToTextStore.getState().isWorkerInitialized && retries < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        retries++;
                      }
                      
                      if (!useSpeechToTextStore.getState().isWorkerInitialized) {
                        console.error('Worker initialization timed out');
                        return;
                      }
                    }
                    
                    // Then process the element
                    await handleProcess();
                  } catch (error) {
                    console.error('Error in generate subtitles:', error);
                  }
                }}
                disabled={!selectedElementInfo || processingStatus.isProcessing || (!deviceCapabilities?.hasWASM && !deviceCapabilities?.hasWebGPU)}
                className="flex-1"
              >
                {processingStatus.isProcessing 
                  ? "Processing..." 
                  : "Generate Subtitles"
                }
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {!selectedElementInfo 
                ? "Select an audio/video element in the timeline first" 
                : processingStatus.isProcessing
                ? "Processing audio to generate subtitles..."
                : "Generate captions from selected element audio"
              }
            </TooltipContent>
          </Tooltip>
          
          {results.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="text"
                  size="icon"
                  onClick={clearResults}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear all caption results</TooltipContent>
            </Tooltip>
          )}
        </div>
        {processingStatus.isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="capitalize flex items-center gap-2">
                {processingStatus.stage === 'downloading' && (
                  <>
                    <RefreshCwIcon className="w-3 h-3 animate-spin" />
                    Downloading model
                  </>
                )}
                {processingStatus.stage === 'initializing' && (
                  <>
                    <RefreshCwIcon className="w-3 h-3 animate-spin" />
                    Initializing
                  </>
                )}
                {processingStatus.stage === 'loading' && (
                  <>
                    <RefreshCwIcon className="w-3 h-3 animate-spin" />
                    Loading audio
                  </>
                )}
                {processingStatus.stage === 'transcribing' && (
                  <>
                    <MicIcon className="w-3 h-3" />
                    Transcribing
                  </>
                )}
                {!['downloading', 'initializing', 'loading', 'transcribing'].includes(processingStatus.stage) && (
                  <>
                    <RefreshCwIcon className="w-3 h-3 animate-spin" />
                    {processingStatus.stage}
                  </>
                )}
              </span>
              <span className="font-mono">{processingStatus.progress}%</span>
            </div>
            <Progress 
              value={processingStatus.progress} 
              className="h-2 bg-panel-accent" 
            />
            {processingStatus.stage === 'transcribing' && processingStatus.progress > 10 && (
              <div className="text-xs text-muted-foreground text-center">
                Processing speech audio...
              </div>
            )}
          </div>
        )}

        {processingStatus.stage === 'error' && processingStatus.error && (
          <Alert variant="destructive">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertDescription>{processingStatus.error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          {results.length === 0 && (
            <div className="bg-panel p-8 flex flex-col items-center justify-center gap-3 rounded-md">
              <MicIcon className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
              <div className="text-center">
                <p className="text-lg font-medium">No captions yet</p>
                <p className="text-sm text-muted-foreground text-balance">
                  Select an audio/video element in the timeline and generate captions
                </p>
              </div>
            </div>
          )}
          
          {results.map((result) => (
            <CaptionResultCard
              key={result.id}
              result={result}
              onRemove={() => removeResult(result.id)}
              onInsertToTimeline={() => insertResultToTimeline(result.id, textInsertMode)}
              onDownloadSRT={() => downloadSRT(result.id)}
              onViewSegments={() => setViewingSegments(result.id)}
            />
          ))}
        </div>

        {viewingSegments && (
          <SegmentViewer 
            result={results.find(r => r.id === viewingSegments)} 
            onClose={() => setViewingSegments(null)}
          />
        )}
      </div>
    </ScrollArea>
  );}

interface CaptionResultCardProps {
  result: any; // TranscriptionResult type from store
  onRemove: () => void;
  onInsertToTimeline: () => void;
  onDownloadSRT: () => void;
  onViewSegments: () => void;
}

function CaptionResultCard({
  result,
  onRemove,
  onInsertToTimeline,
  onDownloadSRT,
  onViewSegments,
}: CaptionResultCardProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = result.chunks.length > 0 
    ? result.chunks[result.chunks.length - 1]?.timestamp[1] 
    : 0;

  return (
    <div className="space-y-2">
      <div className="group flex items-center gap-3 opacity-100 hover:opacity-75 transition-opacity">
        <div className="relative w-8 h-8 bg-accent rounded-md flex items-center justify-center overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
          <MicIcon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="font-medium truncate text-sm" title={result.trackName}>{result.trackName}</p>
          <span className="text-xs text-muted-foreground truncate block">
            {result.chunks.length} segments • {formatDuration(totalDuration)}
          </span>
        </div>

        <div className="flex items-center gap-3 pr-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="text"
                size="icon"
                className="text-muted-foreground hover:text-foreground !opacity-100 w-auto"
                onClick={onViewSegments}
              >
                <EyeIcon className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View transcript segments</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="text"
                size="icon"
                className="text-muted-foreground hover:text-foreground !opacity-100 w-auto"
                onClick={onInsertToTimeline}
              >
                <PlusIcon className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert captions as text elements into timeline</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="text"
                size="icon"
                className="text-muted-foreground hover:text-foreground !opacity-100 w-auto"
                onClick={onDownloadSRT}
              >
                <DownloadIcon className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download as SRT subtitle file</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="text"
                size="icon"
                className="text-muted-foreground hover:text-destructive !opacity-100 w-auto"
                onClick={onRemove}
              >
                <TrashIcon className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove this caption result</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

interface SegmentViewerProps {
  result: any; // TranscriptionResult
  onClose: () => void;
}

function SegmentViewer({ result, onClose }: SegmentViewerProps) {
  if (!result) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 py-2">
        <CardTitle className="text-sm font-medium">Transcript Segments</CardTitle>
        <Button variant="outline" size="sm" onClick={onClose} className="h-6 w-6 p-0">
        <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-3">
        <ScrollArea className="h-48">
          <div className="space-y-2">
            {result.chunks.map((chunk: any, index: number) => (
              <div key={index} className="border-l-2 border-primary/20 pl-2 py-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span>#{index + 1}</span>
                  <span>{formatTime(chunk.timestamp[0])} → {formatTime(chunk.timestamp[1])}</span>
                  <span>({(chunk.timestamp[1] - chunk.timestamp[0]).toFixed(1)}s)</span>
                </div>
                <p className="text-sm">{chunk.text}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}