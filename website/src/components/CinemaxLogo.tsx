import React from "react";

interface CinemaxLogoProps {
  className?: string;
  compact?: boolean;
}

export const CinemaxLogo: React.FC<CinemaxLogoProps> = ({ className = "", compact = false }) => {
  return (
    <div className={`flex items-center justify-center ${className}`.trim()}>
      <div className={compact ? "relative flex h-10 w-10 items-center justify-center" : "relative flex items-center justify-center gap-3"}>
        <svg 
          viewBox="0 0 100 100" 
          className={compact ? "h-10 w-10" : "h-12 w-12"} 
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#39FF14" />
              <stop offset="50%" stopColor="#00FF88" />
              <stop offset="100%" stopColor="#00CC66" />
            </linearGradient>
            <linearGradient id="logoGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00FF88" />
              <stop offset="100%" stopColor="#39FF14" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="innerGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Background circle with subtle gradient */}
          <circle 
            cx="50" 
            cy="50" 
            r="45" 
            fill="none" 
            stroke="url(#logoGradient)" 
            strokeWidth="2" 
            opacity="0.3"
          />
          
          {/* Main C shape - outer ring */}
          <path
            d="M75 50 A25 25 0 1 1 50 25"
            fill="none"
            stroke="url(#logoGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            filter="url(#glow)"
          />
          
          {/* Inner accent line */}
          <path
            d="M68 50 A18 18 0 1 1 50 32"
            fill="none"
            stroke="url(#logoGradient2)"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.8"
            filter="url(#innerGlow)"
          />
          
          {/* Center dot */}
          <circle 
            cx="50" 
            cy="50" 
            r="6" 
            fill="url(#logoGradient)"
            filter="url(#glow)"
          />
          
          {/* Play triangle indicator */}
          <path
            d="M46 44 L46 56 L56 50 Z"
            fill="#0a0a0a"
            filter="url(#innerGlow)"
          />
        </svg>
        
        {!compact && (
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tight text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              CINEMAX
            </span>
            <span className="text-[10px] font-bold tracking-[0.3em] text-[#39FF14] uppercase">
              Stream
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
