import { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { buildTrailerEmbedUrl, buildOwnedVideoUrl, TRAILER_IFRAME_ALLOW } from "../utils/legalPlayback";
import { X, Maximize2, Play, Pause, Volume2, VolumeX, Move } from "lucide-react";

export const PipPlayer: React.FC = () => {
  const {
    pipMovie,
    setPipMovie,
    pipProgress,
    setPipProgress,
    pipSeason,
    pipEpisode,
    pipIsPlaying,
    setPipIsPlaying,
    setCurrentView,
    setSelectedMovie,
    setPlayerMode,
    updateHistoryProgress
  } = useApp();

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [isMuted, setIsMuted] = useState(true); // iframe standard autoplay requires muting initially

  // Save progress periodically if playing
  useEffect(() => {
    if (!pipMovie || !pipIsPlaying) return;

    const interval = setInterval(() => {
      setPipProgress(prev => Math.min(prev + 0.1, 100));
    }, 4000);

    return () => clearInterval(interval);
  }, [pipMovie, pipIsPlaying, setPipProgress]);

  // Sync PIP progress percent with watch history
  useEffect(() => {
    if (pipMovie && pipProgress > 0) {
      updateHistoryProgress(pipMovie.id, Math.round(pipProgress));
    }
  }, [pipProgress, pipMovie?.id, updateHistoryProgress]);

  if (!pipMovie) return null;

  const type = !pipMovie.title ? "tv" : "movie";

  // Legal playback: either the admin's own uploaded video file, or the
  // official trailer. No third-party embeds.
  const hasOwnedVideo = !!pipMovie.videoUrl;
  const mediaUrl = hasOwnedVideo
    ? buildOwnedVideoUrl(pipMovie.videoUrl!)
    : pipMovie.trailerYoutubeKey
    ? buildTrailerEmbedUrl(pipMovie.trailerYoutubeKey)
    : "";

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    
    // Constrain inside screen bounds roughly
    const boundedX = Math.max(-window.innerWidth + 350, Math.min(20, newX));
    const boundedY = Math.max(-window.innerHeight + 250, Math.min(20, newY));

    setPosition({ x: boundedX, y: boundedY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, position]);

  const restorePlayer = () => {
    setSelectedMovie(pipMovie);
    setPlayerMode(hasOwnedVideo ? "full" : "trailer");
    setCurrentView("player");
    setPipMovie(null); // turn off pip
  };

  const handleClose = () => {
    setPipMovie(null);
    setPipIsPlaying(false);
  };

  return (
    <div
      id="pip-container"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`
      }}
      className="fixed bottom-4 right-4 w-80 h-48 rounded-2xl overflow-hidden glass-card shadow-2xl border border-white/10 z-50 flex flex-col transition-shadow hover:shadow-[#39FF14]/10"
    >
      {/* Title Bar / Dragger */}
      <div
        id="pip-header"
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-3 py-1.5 bg-[#0a0a0a]/60 cursor-grab active:cursor-grabbing select-none border-b border-white/5 text-[10px] text-neutral-400 font-sans"
      >
        <div className="flex items-center gap-1.5 font-semibold truncate max-w-[70%]">
          <Move className="h-3 w-3 text-[#39FF14] shrink-0" />
          <span className="truncate text-neutral-200">
            {pipMovie.title || pipMovie.name} {type === "tv" ? `S${pipSeason} E${pipEpisode}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="pip-restore"
            onClick={restorePlayer}
            title="Restore Fullscreen"
            className="p-1 hover:text-[#39FF14] text-neutral-400 transition-all cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            id="pip-close"
            onClick={handleClose}
            title="Close"
            className="p-1 hover:text-red-500 text-neutral-400 transition-all cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Frame content */}
      <div id="pip-media-wrapper" className="flex-1 bg-[#0a0a0a] relative">
        {hasOwnedVideo ? (
          <video
            src={mediaUrl}
            className="w-full h-full pointer-events-none"
            muted={isMuted}
            autoPlay
            playsInline
          />
        ) : mediaUrl ? (
          <iframe
            src={mediaUrl}
            className="w-full h-full border-0 pointer-events-none"
            allow={TRAILER_IFRAME_ALLOW}
            allowFullScreen={false}
            referrerPolicy="origin"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-500">
            No trailer available
          </div>
        )}

        {/* Floating controls in PIP overlay */}
        <div id="pip-controls-overlay" className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent flex flex-col justify-between opacity-0 hover:opacity-100 transition-opacity p-2.5">
          <div className="self-end bg-[#0a0a0a]/50 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold text-[#39FF14] border border-[#39FF14]/20 uppercase">
            {hasOwnedVideo ? "Video" : "Trailer"}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              id="pip-play-pause"
              onClick={() => setPipIsPlaying(!pipIsPlaying)}
              className="bg-[#39FF14] text-black rounded-full p-1.5 hover:scale-105 transition-transform cursor-pointer"
            >
              {pipIsPlaying ? (
                <Pause className="h-3 w-3 fill-black text-black" />
              ) : (
                <Play className="h-3 w-3 fill-black text-black" />
              )}
            </button>

            {/* Playback Progress Mini Indicator */}
            <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden relative mx-2">
              <div
                style={{ width: `${pipProgress}%` }}
                className="absolute top-0 bottom-0 left-0 bg-[#39FF14] shadow-[0_0_8px_#39FF14]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                id="pip-mute-btn"
                onClick={() => setIsMuted(!isMuted)}
                className="text-neutral-300 hover:text-white transition-all cursor-pointer"
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <span className="text-[9px] font-mono text-neutral-400">
                {Math.round(pipProgress)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
