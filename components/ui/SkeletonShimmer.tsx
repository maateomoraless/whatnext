"use client";

type SkeletonShimmerProps = {
  className?: string;
  rounded?: "lg" | "xl" | "md" | "full";
};

const roundedMap = {
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full"
};

export function SkeletonShimmer({ className = "", rounded = "xl" }: SkeletonShimmerProps) {
  return (
    <div className={`relative overflow-hidden bg-[#252525] ${roundedMap[rounded]} ${className}`}>
      <div
        className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
        style={{ width: "55%", left: "-10%" }}
      />
    </div>
  );
}

export function SkeletonMovieCard() {
  return (
    <article className="w-[140px] flex-shrink-0">
      <SkeletonShimmer className="h-[190px] w-full" rounded="xl" />
      <SkeletonShimmer className="mt-2 h-3 w-4/5" rounded="md" />
      <SkeletonShimmer className="mt-2 h-2 w-2/5" rounded="md" />
      <SkeletonShimmer className="mt-2 h-2 w-3/5" rounded="md" />
    </article>
  );
}

export function SkeletonTextLine({ className = "" }: { className?: string }) {
  return <SkeletonShimmer className={`h-3 ${className}`} rounded="md" />;
}
