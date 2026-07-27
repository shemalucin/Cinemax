import React from "react";

/**
 * Skeleton loader components for various UI elements
 * Provides visual feedback while content is loading
 */

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div
    className={`animate-pulse bg-neutral-800 rounded-md ${className}`}
    aria-hidden="true"
  />
);

export const MovieCardSkeleton: React.FC = () => (
  <div className="flex-shrink-0 w-40 sm:w-44 md:w-48">
    <Skeleton className="w-full aspect-[2/3] rounded-lg mb-2" />
    <Skeleton className="h-4 w-3/4 mb-1" />
    <Skeleton className="h-3 w-1/2" />
  </div>
);

export const HeroSkeleton: React.FC = () => (
  <div className="relative w-full h-[70vh] min-h-[500px] max-h-[700px] bg-neutral-900 animate-pulse">
    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
  </div>
);

export const TextSkeleton: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 3, 
  className = "" 
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton 
        key={i} 
        className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} 
      />
    ))}
  </div>
);

export const ButtonSkeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <Skeleton className={`h-10 w-24 rounded-lg ${className}`} />
);

export const AvatarSkeleton: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <Skeleton 
    className="rounded-full" 
    style={{ width: size, height: size }} 
  />
);

export const GridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <MovieCardSkeleton key={i} />
    ))}
  </div>
);
