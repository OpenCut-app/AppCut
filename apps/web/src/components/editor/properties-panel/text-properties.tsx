import { Textarea } from "@/components/ui/textarea";
import { FontPicker } from "@/components/ui/font-picker";
import { FontFamily } from "@/constants/font-constants";
import { TextElement } from "@/types/timeline";
import { useTimelineStore } from "@/stores/timeline-store";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch"; // Add Switch import
import { useState, useRef } from "react";
import {
  PropertyItem,
  PropertyItemLabel,
  PropertyItemValue,
} from "./property-item";

export function TextProperties({
  element,
  trackId,
}: {
  element: TextElement;
  trackId: string;
}) {
  const { updateTextElement } = useTimelineStore();

  // Local state for input values to allow temporary empty/invalid states
  const [fontSizeInput, setFontSizeInput] = useState(
    element.fontSize.toString()
  );
  const [opacityInput, setOpacityInput] = useState(
    Math.round(element.opacity * 100).toString()
  );

  // Track the last selected color for toggling
  const lastSelectedColor = useRef("#000000");

  const parseAndValidateNumber = (
    value: string,
    min: number,
    max: number,
    fallback: number
  ): number => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  };

  const handleFontSizeChange = (value: string) => {
    setFontSizeInput(value);

    if (value.trim() !== "") {
      const fontSize = parseAndValidateNumber(value, 8, 300, element.fontSize);
      updateTextElement(trackId, element.id, { fontSize });
    }
  };

  const handleFontSizeBlur = () => {
    const fontSize = parseAndValidateNumber(
      fontSizeInput,
      8,
      300,
      element.fontSize
    );
    setFontSizeInput(fontSize.toString());
    updateTextElement(trackId, element.id, { fontSize });
  };

  const handleOpacityChange = (value: string) => {
    setOpacityInput(value);

    if (value.trim() !== "") {
      const opacityPercent = parseAndValidateNumber(
        value,
        0,
        100,
        Math.round(element.opacity * 100)
      );
      updateTextElement(trackId, element.id, { opacity: opacityPercent / 100 });
    }
  };

  const handleOpacityBlur = () => {
    const opacityPercent = parseAndValidateNumber(
      opacityInput,
      0,
      100,
      Math.round(element.opacity * 100)
    );
    setOpacityInput(opacityPercent.toString());
    updateTextElement(trackId, element.id, { opacity: opacityPercent / 100 });
  };

  // Update last selected color when a new color is picked
  const handleColorChange = (color: string) => {
    if (color !== "transparent") {
      lastSelectedColor.current = color;
    }
    updateTextElement(trackId, element.id, { backgroundColor: color });
  };

  // Toggle between transparent and last selected color
  const handleTransparentToggle = (isTransparent: boolean) => {
    const newColor = isTransparent ? "transparent" : lastSelectedColor.current;
    updateTextElement(trackId, element.id, { backgroundColor: newColor });
  };

  return (
    <div className="space-y-6 p-5">
      <Textarea
        placeholder="Name"
        defaultValue={element.content}
        className="min-h-18 resize-none bg-background/50"
        onChange={(e) =>
          updateTextElement(trackId, element.id, { content: e.target.value })
        }
      />
      <PropertyItem direction="row">
        <PropertyItemLabel>Font</PropertyItemLabel>
        <PropertyItemValue>
          <FontPicker
            defaultValue={element.fontFamily}
            onValueChange={(value: FontFamily) =>
              updateTextElement(trackId, element.id, { fontFamily: value })
            }
          />
        </PropertyItemValue>
      </PropertyItem>
      <PropertyItem direction="column">
        <PropertyItem direction="row">
          <PropertyItemLabel>Style</PropertyItemLabel>
          <PropertyItemValue>
            <div className="flex items-center gap-2">
              <Button
                variant={element.fontWeight === "bold" ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  updateTextElement(trackId, element.id, {
                    fontWeight:
                      element.fontWeight === "bold" ? "normal" : "bold",
                  })
                }
                className="h-8 px-3 font-bold"
              >
                B
              </Button>
              <Button
                variant={element.fontStyle === "italic" ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  updateTextElement(trackId, element.id, {
                    fontStyle:
                      element.fontStyle === "italic" ? "normal" : "italic",
                  })
                }
                className="h-8 px-3 italic"
              >
                I
              </Button>
              <Button
                variant={
                  element.textDecoration === "underline" ? "default" : "outline"
                }
                size="sm"
                onClick={() =>
                  updateTextElement(trackId, element.id, {
                    textDecoration:
                      element.textDecoration === "underline"
                        ? "none"
                        : "underline",
                  })
                }
                className="h-8 px-3 underline"
              >
                U
              </Button>
              <Button
                variant={
                  element.textDecoration === "line-through"
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() =>
                  updateTextElement(trackId, element.id, {
                    textDecoration:
                      element.textDecoration === "line-through"
                        ? "none"
                        : "line-through",
                  })
                }
                className="h-8 px-3 line-through"
              >
                S
              </Button>
            </div>
          </PropertyItemValue>
        </PropertyItem>
        <PropertyItemLabel>Font size</PropertyItemLabel>
        <PropertyItemValue>
          <div className="flex items-center gap-2">
            <Slider
              value={[element.fontSize]}
              min={8}
              max={300}
              step={1}
              onValueChange={([value]) => {
                updateTextElement(trackId, element.id, { fontSize: value });
                setFontSizeInput(value.toString());
              }}
              className="w-full"
            />
            <Input
              type="number"
              value={fontSizeInput}
              min={8}
              max={300}
              onChange={(e) => handleFontSizeChange(e.target.value)}
              onBlur={handleFontSizeBlur}
              className="w-12 !text-xs h-7 rounded-sm text-center
               [appearance:textfield]
               [&::-webkit-outer-spin-button]:appearance-none
               [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </PropertyItemValue>
      </PropertyItem>
      <PropertyItem direction="row">
        <PropertyItemLabel>Color</PropertyItemLabel>
        <PropertyItemValue>
          <Input
            type="color"
            value={element.color || "#ffffff"}
            onChange={(e) => {
              const color = e.target.value;
              updateTextElement(trackId, element.id, { color });
            }}
            className="w-full cursor-pointer rounded-full"
          />
        </PropertyItemValue>
      </PropertyItem>
      <PropertyItem direction="column">
        <div className="flex items-center justify-between">
          <PropertyItemLabel>Background</PropertyItemLabel>
          <div className="flex items-center space-x-2">
            <Switch
              id="transparent-bg-toggle"
              checked={element.backgroundColor === "transparent"}
              onCheckedChange={handleTransparentToggle}
            />
            <label htmlFor="transparent-bg-toggle" className="text-sm font-medium">
              Transparent
            </label>
          </div>
        </div>
        <PropertyItemValue>
          <Input
            type="color"
            value={
              element.backgroundColor === "transparent"
                ? lastSelectedColor.current
                : element.backgroundColor || "#000000"
            }
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-full cursor-pointer rounded-full"
            disabled={element.backgroundColor === "transparent"}
          />
        </PropertyItemValue>
      </PropertyItem>
      <PropertyItem direction="column">
        <PropertyItemLabel>Opacity</PropertyItemLabel>
        <PropertyItemValue>
          <div className="flex items-center gap-2">
            <Slider
              value={[element.opacity * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([value]) => {
                updateTextElement(trackId, element.id, {
                  opacity: value / 100,
                });
                setOpacityInput(value.toString());
              }}
              className="w-full"
            />
            <Input
              type="number"
              value={opacityInput}
              min={0}
              max={100}
              onChange={(e) => handleOpacityChange(e.target.value)}
              onBlur={handleOpacityBlur}
              className="w-12 !text-xs h-7 rounded-sm text-center
               [appearance:textfield]
               [&::-webkit-outer-spin-button]:appearance-none
               [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </PropertyItemValue>
      </PropertyItem>
    </div>
  );
}
