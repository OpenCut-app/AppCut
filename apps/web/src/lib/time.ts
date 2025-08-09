// Time-related utility functions

type TimeCode = "MM:SS" | "HH:MM:SS" | "HH:MM:SS:CS" | "HH:MM:SS:FF";

// Helper function to format time in various formats (MM:SS, HH:MM:SS, HH:MM:SS:CS, HH:MM:SS:FF)
export const formatTimeCode = (
  timeInSeconds: number,
  format: TimeCode = "HH:MM:SS:CS",
  fps = 30
): string => {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const centiseconds = Math.floor((timeInSeconds % 1) * 100);
  const frames = Math.floor((timeInSeconds % 1) * fps);

  switch (format) {
    case "MM:SS":
      return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    case "HH:MM:SS":
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    case "HH:MM:SS:CS":
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${centiseconds.toString().padStart(2, "0")}`;
    case "HH:MM:SS:FF":
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  }
};

export const parseTimeCode = (
  timeCode: string,
  format: TimeCode = "HH:MM:SS:CS",
  fps = 30
): number | null => {
  if (!timeCode || typeof timeCode !== "string") return null;

  // Remove any extra whitespace
  const cleanTimeCode = timeCode.trim();

  try {
    switch (format) {
      case "MM:SS": {
        const parts = cleanTimeCode.split(":");
        if (parts.length !== 2) return null;
        const [minutes, seconds] = parts.map((part) => parseInt(part, 10));
        if (isNaN(minutes) || isNaN(seconds)) return null;
        if (minutes < 0 || seconds < 0 || seconds >= 60) return null;
        return minutes * 60 + seconds;
      }

      case "HH:MM:SS": {
        const parts = cleanTimeCode.split(":");
        if (parts.length !== 3) return null;
        const [hours, minutes, seconds] = parts.map((part) =>
          parseInt(part, 10)
        );
        if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
        if (
          hours < 0 ||
          minutes < 0 ||
          seconds < 0 ||
          minutes >= 60 ||
          seconds >= 60
        )
          return null;
        return hours * 3600 + minutes * 60 + seconds;
      }

      case "HH:MM:SS:CS": {
        const parts = cleanTimeCode.split(":");
        if (parts.length !== 4) return null;
        const [hours, minutes, seconds, centiseconds] = parts.map((part) =>
          parseInt(part, 10)
        );
        if (
          isNaN(hours) ||
          isNaN(minutes) ||
          isNaN(seconds) ||
          isNaN(centiseconds)
        )
          return null;
        if (
          hours < 0 ||
          minutes < 0 ||
          seconds < 0 ||
          centiseconds < 0 ||
          minutes >= 60 ||
          seconds >= 60 ||
          centiseconds >= 100
        )
          return null;
        return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
      }

      case "HH:MM:SS:FF": {
        const parts = cleanTimeCode.split(":");
        if (parts.length !== 4) return null;
        const [hours, minutes, seconds, frames] = parts.map((part) =>
          parseInt(part, 10)
        );
        if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(frames))
          return null;
        if (
          hours < 0 ||
          minutes < 0 ||
          seconds < 0 ||
          frames < 0 ||
          minutes >= 60 ||
          seconds >= 60 ||
          frames >= fps
        )
          return null;
        return hours * 3600 + minutes * 60 + seconds + frames / fps;
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const guessTimeCodeFormat = (timeCode: string): TimeCode | null => {
  if (!timeCode || typeof timeCode !== "string") return null;

  const numbers = timeCode.split(":");

  if (!numbers.every((n) => !isNaN(Number(n)))) return null;

  if (numbers.length === 2) return "MM:SS";
  if (numbers.length === 3) return "HH:MM:SS";
  // todo: how to tell frames apart from cs?
  if (numbers.length === 4) return "HH:MM:SS:FF";

  return null;
};
