import { Skeleton } from "./ui/skeleton";

interface MediaSkeletonsProps {
  /**
   * Number of media skeletons to display
   */
  count: number;

  view: "grid" | "list";
}

export const MediaSkeletons = ({ count, view }: MediaSkeletonsProps) => {
  return (
    <div className="h-full flex flex-col gap-1 transition-colors relative">
      {/* Search and filter controls skeleton */}
      <div className="p-3 pb-2">
        <div className="flex gap-2">
          <Skeleton className="w-[80%] h-10" /> {/* Filter dropdown */}
          <Skeleton className="flex-1 h-10" /> {/* Search input */}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 pt-0 scrollbar-thin">
        {view === "list" ? (
          <div className="space-y-1 w-full">
            {/* thumbnail skeletons */}
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="h-10 flex items-center gap-3 w-full">
                <Skeleton className="size-6 shrink-0 rounded" />
                <Skeleton className="w-full h-6 flex-1" />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: "repeat(auto-fill, 160px)",
            }}
          >
            {/* thumbnail skeletons */}
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 w-28 h-28">
                <Skeleton className="w-full aspect-video" />
                <Skeleton className="w-full h-4" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
