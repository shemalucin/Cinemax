import React, { useState, useEffect, useRef } from "react";
import { Movie } from "../types";
import { getImageUrl } from "../utils/tmdb";
import { Play, Plus, Info, ChevronRight, Volume2, VolumeX } from "lucide-react";

interface SmartTVDisplayProps {
  shows: Movie[];
  onWatchNow?: (show: Movie) => void;
  onMyList?: (show: Movie) => void;
  onMoreInfo?: (show: Movie) => void;
}

export const SmartTVDisplay: React.FC<SmartTVDisplayProps> = ({ 
  shows, 
  onWatchNow, 
  onMyList,
  onMoreInfo 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentShow = shows[currentIndex] || shows[0];

  useEffect(() => {
    if (!shows.length) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % shows.length);
        setTimeout(() => setIsAnimating(false), 100);
      }, 300);
    }, 8000); // Change show every 8 seconds

    return () => clearInterval(interval);
  }, [shows.length]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const handleWatchNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onWatchNow && currentShow) {
      onWatchNow(currentShow);
    }
  };

  const handleMyList = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent More Info action
    if (onMyList && currentShow) {
      onMyList(currentShow);
    }
  };

  const handleMoreInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMoreInfo && currentShow) {
      onMoreInfo(currentShow);
    }
  };

  const goToNext = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % shows.length);
      setTimeout(() => setIsAnimating(false), 100);
    }, 300);
  };

  const goToPrev = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + shows.length) % shows.length);
      setTimeout(() => setIsAnimating(false), 100);
    }, 300);
  };

  if (!currentShow) return null;

  const backdropUrl = getImageUrl(currentShow.backdrop_path, "original");
  const posterUrl = getImageUrl(currentShow.poster_path, "w500");

  return (
    <div className="flat-tv-container">
      <div className="flat-tv-frame">
        {/* TV Screen */}
        <div className="flat-tv-screen">
          {/* Background Image */}
          <div 
            className={`tv-background-wrapper ${isAnimating ? 'fade-transition' : ''}`}
          >
            <img
              src={backdropUrl || posterUrl}
              alt={currentShow.title || currentShow.name}
              className="tv-background"
            />
            <div className="tv-gradient-overlay" />
          </div>

          {/* TV Content */}
          <div className="tv-content">
            {/* Header */}
            <div className="tv-header">
              <div className="tv-badge">FEATURED</div>
              <button
                onClick={toggleMute}
                className="tv-mute-btn"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Show Info */}
            <div className="tv-show-details">
              <h2 className="tv-title">{currentShow.title || currentShow.name}</h2>
              <p className="tv-description">
                {currentShow.overview?.slice(0, 120) || "No description available"}
                {currentShow.overview?.length > 120 ? "..." : ""}
              </p>
              
              <div className="tv-meta">
                <span className="tv-year">
                  {currentShow.first_air_date?.split("-")[0] || currentShow.release_date?.split("-")[0] || "2024"}
                </span>
                <span className="tv-rating">
                  ⭐ {currentShow.vote_average?.toFixed(1)}
                </span>
                <span className="tv-quality">HD</span>
              </div>

              {/* Action Buttons */}
              <div className="tv-actions">
                <button
                  onClick={handleWatchNow}
                  className="tv-watch-btn btn-animate"
                >
                  <Play className="h-4 w-4 mr-2" fill="currentColor" />
                  Watch Now
                </button>
                <button
                  onClick={handleMyList}
                  className="tv-list-btn btn-animate"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  My List
                </button>
                <button
                  onClick={handleMoreInfo}
                  className="tv-info-btn btn-animate"
                >
                  <Info className="h-4 w-4 mr-2" />
                  More Info
                </button>
              </div>
            </div>

            {/* Navigation */}
            <div className="tv-navigation">
              <button onClick={goToPrev} className="tv-nav-btn">
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
              <div className="tv-progress">
                {shows.map((_, idx) => (
                  <div
                    key={idx}
                    className={`tv-progress-dot ${idx === currentIndex ? "active" : ""}`}
                  />
                ))}
              </div>
              <button onClick={goToNext} className="tv-nav-btn">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* TV Stand */}
        <div className="tv-stand">
          <div className="tv-stand-neck" />
          <div className="tv-stand-base" />
        </div>
      </div>
    </div>
  );
};
