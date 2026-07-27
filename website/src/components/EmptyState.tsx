import React from "react";
import { Film, Search, Heart, Bookmark, Clock, AlertCircle } from "lucide-react";

interface EmptyStateProps {
  type: "movies" | "tv" | "search" | "favorites" | "watchlist" | "history" | "error";
  message?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ type, message, action }) => {
  const configs = {
    movies: {
      icon: Film,
      title: "No movies found",
      description: message || "There are no movies available right now. Check back later!",
    },
    tv: {
      icon: Film,
      title: "No TV shows found",
      description: message || "There are no TV shows available right now. Check back later!",
    },
    search: {
      icon: Search,
      title: "No results found",
      description: message || "Try searching for something else or browse our categories.",
    },
    favorites: {
      icon: Heart,
      title: "No favorites yet",
      description: message || "Start adding movies to your favorites to see them here.",
    },
    watchlist: {
      icon: Bookmark,
      title: "Your watchlist is empty",
      description: message || "Add movies to your watchlist to keep track of what you want to watch.",
    },
    history: {
      icon: Clock,
      title: "No watch history",
      description: message || "Movies you watch will appear here so you can easily find them again.",
    },
    error: {
      icon: AlertCircle,
      title: "Unable to load content",
      description: message || "Something went wrong while loading. Please try again.",
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-neutral-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{config.title}</h3>
      <p className="text-sm text-neutral-400 max-w-md mb-6">{config.description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
