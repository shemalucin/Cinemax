import React, { useState, useEffect, useRef } from "react";

interface CinemaxTypingLogoProps {
  onComplete?: () => void;
}

export const CinemaxTypingLogo: React.FC<CinemaxTypingLogoProps> = ({ onComplete }) => {
  const [displayText, setDisplayText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  
  // Maintain current index across re-renders cleanly without closure bugs
  const currentIndexRef = useRef(0);
  
  // Save onComplete to a mutable ref so changes to it never restart the execution timer loop
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const targetText = "CINEMAX";

  // Whole sequence — initial delay + typing + hold before onComplete — is
  // tuned to land at exactly 2000ms total, as requested for the post-sign-in
  // brand moment.
  const initialDelayMs = 150;
  const holdAfterTypingMs = 450;
  const totalDuration = 2000 - initialDelayMs - holdAfterTypingMs; // 1400ms of actual typing
  const charDelay = totalDuration / targetText.length; // Each letter lands evenly across that window

  useEffect(() => {
    // Force index reset on initial mount lifecycle
    currentIndexRef.current = 0;
    
    const typeNextChar = () => {
      if (currentIndexRef.current < targetText.length) {
        setDisplayText(targetText.slice(0, currentIndexRef.current + 1));
        currentIndexRef.current++;
      } else {
        setIsComplete(true);
        // Turn off interval safely
        clearInterval(typingInterval);
        
        // Wait a brief clean moment with active tagline visibility before closing view
        setTimeout(() => {
          setShowCursor(false);
          // Safely execute using our un-loopable mutable functional ref pointer
          onCompleteRef.current?.();
        }, holdAfterTypingMs);
      }
    };

    // Trigger the first letter 'C' after a short beat so the sequence doesn't feel abrupt
    const initialDelay = setTimeout(typeNextChar, initialDelayMs);
    
    // Set up standard recurring interval cycles
    const typingInterval = setInterval(() => {
      typeNextChar();
    }, charDelay);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(typingInterval);
    };
  }, [charDelay]); // Clean array dependency: onComplete removed to prevent loop bugs completely

  // Separate terminal cursor blink loop hook
  useEffect(() => {
    if (!showCursor) return;
    
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 400); // Cursor na yo iblinka vuba ijyanye na speed nshya

    return () => clearInterval(cursorInterval);
  }, [showCursor]);

  return (
    <div className="cinemax-typing-container">
      <div className="cinemax-typing-content">
        <div className="typing-logo-wrapper">
          {/* TV Icon Display Component */}
          <div className="typing-tv-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
              <polyline points="17 2 12 7 7 2" />
            </svg>
          </div>

          {/* Typewriter Text Rendering Stream Engine */}
          <div className="typing-text-wrapper">
            <span className="typing-text">
              <span className="brand-cinema">{displayText.slice(0, 6)}</span>
              <span className="brand-x">{displayText.slice(6)}</span>
            </span>
            {!isComplete && (
              <span className="typing-pen-nib" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                  <path d="M2 2l7.586 7.586" />
                  <circle cx="11" cy="11" r="2" />
                </svg>
              </span>
            )}
            {showCursor && <span className="typing-cursor">|</span>}
          </div>
        </div>

        {/* Dynamic Tagline - Fades in upon loop conclusion sequence */}
        <p className={`typing-tagline ${isComplete ? 'fade-in' : ''}`}>
          STRICTLY MOVIES & SERIES ONLY
        </p>
      </div>

      <style>{`
        .cinemax-typing-container {
          position: fixed;
          inset: 0;
          background: #0a0a0a;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10001;
        }

        .cinemax-typing-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
        }

        .typing-logo-wrapper {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .typing-tv-icon {
          width: 48px;
          height: 48px;
          background: #39FF14;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          animation: iconPulse 1.5s ease-in-out infinite; /* Icon na yo ipulsa vuba */
        }

        @keyframes iconPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .typing-text-wrapper {
          display: flex;
          align-items: center;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 2.5rem;
          font-weight: 900;
          letter-spacing: -0.05em;
        }

        .typing-text {
          display: flex;
        }

        .brand-cinema {
          color: #ffffff;
        }

        .brand-x {
          color: #39FF14;
        }

        .typing-cursor {
          color: #39FF14;
          animation: cursorBlink 0.4s infinite; /* Cursor iblinka vuba */
          margin-left: 2px;
        }

        .typing-pen-nib {
          position: relative;
          display: inline-flex;
          width: 1.1rem;
          height: 1.1rem;
          margin-left: 1px;
          margin-right: -1.3rem;
          transform: translateY(-1.6rem) rotate(45deg);
          color: #39FF14;
          animation: penWrite 0.28s ease-in-out infinite;
          pointer-events: none;
        }

        .typing-pen-nib svg {
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 0 4px rgba(57, 255, 20, 0.6));
        }

        @keyframes penWrite {
          0%, 100% { transform: translateY(-1.6rem) rotate(45deg); }
          50% { transform: translateY(-1.4rem) rotate(40deg); }
        }

        @keyframes cursorBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .typing-tagline {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.625rem;
          font-weight: 900;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #737373;
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        .typing-tagline.fade-in {
          opacity: 1;
        }

        @media (max-width: 640px) {
          .typing-tv-icon {
            width: 40px;
            height: 40px;
          }

          .typing-text-wrapper {
            font-size: 1.75rem;
          }

          .typing-tagline {
            font-size: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
};
