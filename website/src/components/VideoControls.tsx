import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Settings,
  Maximize,
  Minimize,
  PictureInPicture2,
  Subtitles,
} from "lucide-react";

interface VideoControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  title?: string;
  onEnterPip?: () => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Custom cinematic control bar for the self-hosted <video> element.
 * Replaces the native browser controls with a scrubber, skip ±10s,
 * volume, playback speed, captions toggle, PiP, and fullscreen —
 * all styled in the neon-green Cinemax brand and auto-hiding
 * during playback, matching a premium streaming-platform feel.
 */
export const VideoControls: React.FC<VideoControlsProps> = ({ videoRef, containerRef, title, onEnterPip }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [visible, setVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubPreview, setScrubPreview] = useState<number | null>(null);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!scrubbing && !showSettings) setVisible(false);
    }, 2800);
  }, [scrubbing, showSettings]);

  const wake = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTime = () => setCurrent(v.currentTime);
    const onLoaded = () => setDuration(v.duration || 0);
    const onPlay = () => { setIsPlaying(true); scheduleHide(); };
    const onPause = () => { setIsPlaying(false); setVisible(true); };
    const onVolume = () => { setVolume(v.volume); setMuted(v.muted); };
    const onProgress = () => {
      if (v.buffered.length > 0 && v.duration) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
    };

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("volumechange", onVolume);
    v.addEventListener("progress", onProgress);

    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("volumechange", onVolume);
      v.removeEventListener("progress", onProgress);
    };
  }, [videoRef, scheduleHide]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  const skip = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(v.currentTime + delta, 0), v.duration || Infinity);
    wake();
  };

  const seekTo = (fraction: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = Math.min(Math.max(fraction, 0), 1) * duration;
  };

  const fractionFromEvent = (e: React.MouseEvent | MouseEvent) => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return (e.clientX - rect.left) / rect.width;
  };

  const handleScrubStart = (e: React.MouseEvent) => {
    setScrubbing(true);
    const f = fractionFromEvent(e);
    setScrubPreview(f);
    seekTo(f);
  };

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: MouseEvent) => {
      const f = Math.min(Math.max(fractionFromEvent(e), 0), 1);
      setScrubPreview(f);
      seekTo(f);
    };
    const onUp = () => {
      setScrubbing(false);
      setScrubPreview(null);
      scheduleHide();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubbing, duration]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const setVol = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  };

  const setSpeed = (s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setRate(s);
  };

  const toggleCaptions = () => {
    const v = videoRef.current;
    if (!v) return;
    const track = v.textTracks?.[0];
    if (track) {
      track.mode = captionsOn ? "hidden" : "showing";
      setCaptionsOn(!captionsOn);
    }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const playedFraction = scrubPreview ?? (duration ? current / duration : 0);
  const bufferedFraction = duration ? buffered / duration : 0;
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      className="absolute inset-0 z-10 select-none"
      onMouseMove={wake}
      onMouseLeave={() => { if (isPlaying) setVisible(false); }}
    >
      {/* Center play/pause + skip cluster */}
      <div
        className={`absolute inset-0 flex items-center justify-center gap-10 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => {
          if (e.target === e.currentTarget) togglePlay();
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); skip(-10); }}
          className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/90 flex items-center justify-center hover:bg-black/60 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Back 10 seconds"
        >
          <RotateCcw className="h-5 w-5" />
          <span className="sr-only">-10s</span>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          className="h-16 w-16 rounded-full bg-white/95 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-[0_8px_30px_rgba(0,0,0,0.4)] cursor-pointer"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-7 w-7 fill-black" /> : <Play className="h-7 w-7 fill-black ml-1" />}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); skip(10); }}
          className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/90 flex items-center justify-center hover:bg-black/60 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Forward 10 seconds"
        >
          <RotateCw className="h-5 w-5" />
          <span className="sr-only">+10s</span>
        </button>
      </div>

      {/* Bottom control bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-3 pt-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber */}
        <div
          ref={barRef}
          onMouseDown={handleScrubStart}
          className="group/bar relative h-4 flex items-center cursor-pointer"
        >
          <div className="relative w-full h-1 rounded-full bg-white/20 overflow-hidden group-hover/bar:h-1.5 transition-all">
            <div
              className="absolute inset-y-0 left-0 bg-white/25"
              style={{ width: `${bufferedFraction * 100}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-[#39FF14]"
              style={{ width: `${playedFraction * 100}%` }}
            />
          </div>
          <div
            className="absolute h-3 w-3 rounded-full bg-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.7)] opacity-0 group-hover/bar:opacity-100 transition-opacity"
            style={{ left: `calc(${playedFraction * 100}% - 6px)` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between mt-2 gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={togglePlay} className="text-white/90 hover:text-white cursor-pointer" title={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
            </button>

            <div className="hidden sm:flex items-center gap-2 group/vol">
              <button onClick={toggleMute} className="text-white/90 hover:text-white cursor-pointer" title="Mute">
                <VolIcon className="h-5 w-5" />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => setVol(parseFloat(e.target.value))}
                className="w-0 group-hover/vol:w-20 transition-all duration-300 accent-[#39FF14] h-1 cursor-pointer"
              />
            </div>

            <span className="text-xs font-medium text-white/80 tabular-nums whitespace-nowrap">
              {formatTime(scrubPreview !== null ? scrubPreview * duration : current)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={toggleCaptions}
              className={`hidden sm:flex cursor-pointer ${captionsOn ? "text-[#39FF14]" : "text-white/90 hover:text-white"}`}
              title="Captions"
            >
              <Subtitles className="h-5 w-5" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowSettings((s) => !s)}
                className={`cursor-pointer ${showSettings ? "text-[#39FF14]" : "text-white/90 hover:text-white"}`}
                title="Playback speed"
              >
                <Settings className="h-5 w-5" />
              </button>
              {showSettings && (
                <div className="absolute bottom-8 right-0 rounded-xl bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 py-2 min-w-[120px] shadow-2xl">
                  <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Speed</p>
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSpeed(s); setShowSettings(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                        rate === s ? "text-[#39FF14]" : "text-white/80 hover:text-white"
                      }`}
                    >
                      {s === 1 ? "Normal" : `${s}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {onEnterPip && (
              <button onClick={onEnterPip} className="hidden sm:flex text-white/90 hover:text-white cursor-pointer" title="Picture in picture">
                <PictureInPicture2 className="h-5 w-5" />
              </button>
            )}

            <button onClick={toggleFullscreen} className="text-white/90 hover:text-white cursor-pointer" title="Fullscreen">
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {title && !isPlaying && current === 0 && (
        <div className="absolute top-0 left-0 right-0 p-5 pointer-events-none opacity-0" aria-hidden>
          {title}
        </div>
      )}
    </div>
  );
};
