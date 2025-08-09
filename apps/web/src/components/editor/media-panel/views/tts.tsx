import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, PlusIcon, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { kokoroTTSService } from "@/lib/tts-service";
import { useTimelineStore } from "@/stores/timeline-store";
import { useMediaStore } from "@/stores/media-store";
import { useProjectStore } from "@/stores/project-store";

export function TTSView() {
	const [isInitializing, setIsInitializing] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [initStatus, setInitStatus] = useState<string>("");
	const [text, setText] = useState("");
	const [selectedVoice, setSelectedVoice] = useState("af_heart");
	const [audioObject, setAudioObject] = useState<any>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const { toast } = useToast();

	const voices = kokoroTTSService.getVoices();
	const isReady = kokoroTTSService.isReady();
	const activeProject = useProjectStore((state) => state.activeProject);

	const initializeTTS = async () => {
		setIsInitializing(true);
		setInitStatus("Initializing...");
		
		try {
			toast({
				title: "Downloading TTS Model",
				description: "This may take a few minutes on first use. Please wait...",
			});
			
			await kokoroTTSService.initialize((status, data) => {
				switch (status) {
					case 'device':
						setInitStatus(`Detected device: ${data?.device || "unknown"}`);
						break;
					case 'ready':
						setInitStatus("Ready!");
						toast({
							title: "TTS Ready",
							description: `Text-to-Speech initialized successfully using ${data?.device || "WASM"}`,
						});
						break;
					case 'error':
						throw new Error(data?.error || "Initialization failed");
				}
			});
		} catch (error) {
			console.error("Failed to initialize TTS:", error);
			toast({
				title: "TTS Initialization Failed",
				description: "Failed to initialize TTS. Please try again.",
				variant: "destructive",
			});
		} finally {
			setTimeout(() => {
				setIsInitializing(false);
				setInitStatus("");
			}, 1000);
		}
	};

	const generateSpeech = async () => {
		if (!isReady) {
			toast({
				title: "TTS Not Ready",
				description: "Please wait for TTS to initialize",
				variant: "destructive",
			});
			return;
		}

		if (!text.trim()) {
			toast({
				title: "No Text",
				description: "Please enter some text to convert to speech",
				variant: "destructive",
			});
			return;
		}

		setIsGenerating(true);
		try {
			const audio = await kokoroTTSService.generateSpeech(text, selectedVoice);
			setAudioObject(audio);
			setAudioUrl(audio.url);

			toast({
				title: "Speech Generated",
				description: "Your text has been converted to speech successfully",
			});
		} catch (error) {
			console.error("Failed to generate speech:", error);
			toast({
				title: "Generation Failed",
				description: "Failed to generate speech. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsGenerating(false);
		}
	};

	const addToMedia = async () => {
		if (!audioObject || !activeProject || !audioUrl) {
			toast({
				title: "Cannot Save to Media",
				description: activeProject
					? "Please generate speech first"
					: "No active project",
				variant: "destructive",
			});
			return;
		}

		try {
			// Create a blob from the audio URL
			const response = await fetch(audioUrl);
			const blob = await response.blob();
			const file = new File(
				[blob],
				`tts-${selectedVoice}-${Date.now()}.wav`,
				{ type: "audio/wav" }
			);

			// Add to media store
			const mediaStore = useMediaStore.getState();
			await mediaStore.addMediaItem(activeProject.id, {
				name: `TTS: ${text.substring(0, 30)}${text.length > 30 ? "..." : ""}`,
				type: "audio" as const,
				file,
				url: audioUrl,
				duration: 0, // Duration will be calculated by the media store
			});

			toast({
				title: "Saved to Media",
				description: "TTS audio has been saved to your media library",
			});
		} catch (error) {
			console.error("Failed to save TTS to media:", error);
			toast({
				title: "Error",
				description: "Failed to save TTS audio to media library",
				variant: "destructive",
			});
		}
	};

	const addToTimeline = async () => {
		if (!audioObject || !activeProject) {
			toast({
				title: "Cannot Add to Timeline",
				description: activeProject
					? "Please generate speech first"
					: "No active project",
				variant: "destructive",
			});
			return;
		}

		// First save to media, then add to timeline
		await addToMedia();
		
		// Find the newly added media item and add to timeline
		try {
			const mediaStore = useMediaStore.getState();
			const latestMediaItem = mediaStore.mediaItems[mediaStore.mediaItems.length - 1];
			
			if (latestMediaItem) {
				const timelineStore = useTimelineStore.getState();
				const success = timelineStore.addMediaAtTime(latestMediaItem, 0);

				if (success) {
					toast({
						title: "Added to Timeline",
						description: "TTS audio has been added to the timeline",
					});
				} else {
					toast({
						title: "Failed to Add",
						description: "Could not add TTS audio to timeline",
						variant: "destructive",
					});
				}
			}
		} catch (error) {
			console.error("Failed to add TTS to timeline:", error);
			toast({
				title: "Error",
				description: "Failed to add TTS audio to timeline",
				variant: "destructive",
			});
		}
	};

	const getVoicesByLanguage = (language: string) => {
		return voices.filter((voice) => voice.language === language);
	};

	return (
		<div className="h-full flex flex-col">
			<div className="flex-1 overflow-y-auto p-5 pt-0 space-y-4">
				{!isReady && (
					<div className="flex flex-col items-center justify-center p-4 bg-accent/50 rounded-lg space-y-3">
						{isInitializing ? (
							<>
								<Loader2 className="h-6 w-6 animate-spin" />
								<div className="text-center space-y-2 w-full">
									<div className="font-medium text-sm">Downloading TTS Model</div>
									<div className="text-xs text-muted-foreground">
										{initStatus || "This may take a few minutes..."}
									</div>
								</div>
							</>
						) : (
							<>
								<Volume2 className="h-6 w-6 text-muted-foreground" />
								<div className="text-center space-y-2">
									<div className="font-medium text-sm">Initialize Text to Speech</div>
									<div className="text-xs text-muted-foreground">
										Download the AI voice model to start generating speech.
									</div>
								</div>
								<Button onClick={initializeTTS}>
									<Volume2 className="h-4 w-4 mr-2" />
									Get Started
								</Button>
							</>
						)}
					</div>
				)}

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="tts-text">Enter your text</Label>
						<Textarea
							id="tts-text"
							placeholder="Type what you want to turn into speech..."
							value={text}
							onChange={(e) => setText(e.target.value)}
							rows={3}
							disabled={!isReady}
							className="bg-panel-accent"
						/>
					</div>

					<div className="space-y-2">
						<Label>Choose a voice</Label>
						<Select
							value={selectedVoice}
							onValueChange={setSelectedVoice}
							disabled={!isReady}
						>
							<SelectTrigger className="bg-panel-accent">
								<SelectValue placeholder="Select a voice" />
							</SelectTrigger>
							<SelectContent>
								<div className="p-2">
									<div className="font-semibold text-sm text-muted-foreground mb-2">
										American English
									</div>
									{getVoicesByLanguage("American English").map((voice) => (
										<SelectItem key={voice.id} value={voice.id}>
											<span>{voice.name} ({voice.gender})</span>
										</SelectItem>
									))}
								</div>
								<div className="p-2">
									<div className="font-semibold text-sm text-muted-foreground mb-2">
										British English
									</div>
									{getVoicesByLanguage("British English").map((voice) => (
										<SelectItem key={voice.id} value={voice.id}>
											<span>{voice.name} ({voice.gender})</span>
										</SelectItem>
									))}
								</div>
							</SelectContent>
						</Select>
					</div>

					<Button
						onClick={generateSpeech}
						disabled={!isReady || isGenerating || !text.trim()}
						className="w-full"
					>
						{isGenerating ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<Volume2 className="h-4 w-4 mr-2" />
								Generate Speech
							</>
						)}
					</Button>

					{audioUrl && (
						<div className="space-y-3 p-4 bg-accent/50 rounded-lg">
							<div className="font-medium">Your Generated Audio</div>
							<audio controls className="w-full">
								<source src={audioUrl} type="audio/wav" />
								Your browser does not support audio playback.
							</audio>
							<Button onClick={addToTimeline} className="w-full">
								<PlusIcon className="h-4 w-4 mr-2" />
								Add to Timeline
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}