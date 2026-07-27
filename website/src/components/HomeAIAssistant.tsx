import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Message, Movie } from "../types";
import { getImageUrl } from "../utils/tmdb";
import { askAssistant, stripActionBlocks, generateImage, AgentAction } from "../utils/assistantClient";
import { Sparkles, Send, X, Bot, Loader2, Play, MessageSquareText, ShieldCheck, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { SPEECH_LANG_CODES, TTS_VOICE_CODES } from "../i18n/translations";

interface HomeAIAssistantProps {
  onSelectMovie: (movie: Movie) => void;
  onNavigate?: (view: string) => void;
  onSearch?: (query: string) => void;
  /** When true, the floating launcher button is not rendered. Used on pages
   * (e.g. Live Chat) that have their own bottom composer/UI the launcher
   * would otherwise sit on top of. The panel itself still closes if it was
   * left open when navigating into one of those pages. */
  hideLauncher?: boolean;
}


const HOME_QUICK_PROMPTS = [
  "What should I watch tonight?",
  "Surprise me with something underrated",
  "Best movies trending this week?",
];

export const HomeAIAssistant: React.FC<HomeAIAssistantProps> = ({ onSelectMovie, onNavigate, onSearch, hideLauncher }) => {
  const { user, setSearchQuery, setCurrentView, appLanguage } = useApp();
  const isAdmin = user?.role === "admin";
  const [open, setOpen] = useState(false);

  // Close the panel automatically if we navigate into a page that hides the
  // launcher (e.g. Live Chat) while it was open, so it can't get stranded
  // half-visible behind that page's own UI.
  useEffect(() => {
    if (hideLauncher) setOpen(false);
  }, [hideLauncher]);
  const [hasAutoIntroduced, setHasAutoIntroduced] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: `Hey${user ? ` ${user.name}` : ""}! I'm All Kiki's — your Cinemax AI Agent. I can help you navigate the site, search for movies, generate images, and execute actions. Use **Voice Search** by clicking the microphone or just ask me anything!${isAdmin ? "\n\nI recognize you as an administrator — ask me about the Admin Panel anytime." : ""}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Voice states
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [detectedLanguage, setDetectedLanguage] = useState<string>(SPEECH_LANG_CODES[appLanguage] || "en-US");
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Update detected language when app language changes
  useEffect(() => {
    setDetectedLanguage(SPEECH_LANG_CODES[appLanguage] || "en-US");
  }, [appLanguage]);

  const executeAgentAction = async (action: AgentAction) => {
    try {
      switch (action.type) {
        case "navigate":
          if (onNavigate && action.params?.view) {
            onNavigate(action.params.view);
          } else if (action.params?.view) {
            setCurrentView(action.params.view);
          }
          break;
        case "search":
          if (onSearch && action.params?.query) {
            onSearch(action.params.query);
          } else if (action.params?.query) {
            setSearchQuery(action.params.query);
          }
          break;
        case "play_movie":
          if (action.params?.id && action.params?.title) {
            onSelectMovie({ id: action.params.id, title: action.params.title, media_type: "movie" } as Movie);
          }
          break;
        case "play_tv":
          if (action.params?.id && action.params?.title) {
            onSelectMovie({ id: action.params.id, title: action.params.title, media_type: "tv" } as Movie);
          }
          break;
        case "generate_image":
          if (action.params?.prompt) {
            try {
              const { imageUrl } = await generateImage(action.params.prompt);
              setMessages((prev) => [
                ...prev,
                {
                  role: "model",
                  text: `I've generated an image for you:`,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  generatedImageUrl: imageUrl,
                },
              ]);
            } catch (error) {
              console.error("Image generation failed:", error);
              setMessages((prev) => [
                ...prev,
                {
                  role: "model",
                  text: `Sorry, I couldn't generate the image. Please try again or check if the image generation service is configured.`,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                },
              ]);
            }
          }
          break;
        case "open_help_desk":
          setCurrentView("help");
          break;
        case "download_movie":
          if (action.params?.id && action.params?.title) {
            setMessages((prev) => [
              ...prev,
              {
                role: "model",
                text: `I've initiated the download for "${action.params.title}". You can manage your downloads in the Downloads section.`,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ]);
            setCurrentView("downloads");
          }
          break;
        case "manage_downloads":
          setCurrentView("downloads");
          break;
        case "view_download_history":
          setCurrentView("downloads");
          break;
        default:
          console.log("Unknown action type:", action.type);
      }
    } catch (err) {
      console.error("Failed to execute agent action:", err);
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = SPEECH_LANG_CODES[appLanguage] || "en-US";

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Update input with final transcript
          if (finalTranscript) {
            setInput(finalTranscript);
            
            // Detect language from the recognition
            if (event.results[0] && event.results[0][0].lang) {
              setDetectedLanguage(event.results[0][0].lang);
            }
            
            // Auto-submit after a short delay for better UX
            setTimeout(() => {
              if (finalTranscript.trim()) {
                handleSend(finalTranscript);
              }
            }, 500);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [appLanguage]);

  // Start/Stop listening
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.lang = detectedLanguage;
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        setIsListening(false);
      }
    }
  };

  // Text-to-Speech using OpenAI TTS
  const speakText = async (text: string) => {
    if (!voiceEnabled || !text.trim()) return;

    try {
      setIsSpeaking(true);
      
      // Map detected language to TTS voice code
      const ttsVoice = detectedLanguage || TTS_VOICE_CODES[appLanguage] || "en-US";
      
      // Call backend TTS endpoint
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          text: text.replace(/```action[\s\S]*?```/g, '').trim(),
          language: ttsVoice
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error?.includes('OPENAI_API_KEY')) {
          console.warn('Voice features require OPENAI_API_KEY to be configured');
          setVoiceEnabled(false); // Disable voice if API key is missing
          return;
        }
        throw new Error('TTS request failed');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        
        audioRef.current.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        audioRef.current.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
      }
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (hasAutoIntroduced) return;
    const t = setTimeout(() => setHasAutoIntroduced(true), 2000);
    return () => clearTimeout(t);
  }, [hasAutoIntroduced]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);


  const handleSend = async (textOverride?: string) => {
    const prompt = (textOverride ?? input).trim();
    if (!prompt) return;

    const userMsg: Message = {
      role: "user",
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { text, action } = await askAssistant({
        message: prompt,
        history: messages.map((m) => ({ role: m.role, text: m.text })),
      });
      
      // Execute agent action if present
      if (action) {
        await executeAgentAction(action);
      }
      
      const cleanText = stripActionBlocks(text) || "Here's what I found!";
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: cleanText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      
      // Speak the response if voice is enabled
      await speakText(cleanText);
    } catch (err: any) {
      const errorMessage = err?.message || "Sorry — please try again in a moment.";
      
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: errorMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!hideLauncher && (
      <button
        id="home-ai-launcher"
        onClick={() => setOpen(true)}
        className={`fixed right-4 bottom-24 sm:right-6 sm:bottom-6 z-[100] flex items-center justify-center h-14 w-14 rounded-full bg-[#39FF14] text-black shadow-[0_0_25px_rgba(57,255,20,0.55)] border border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer group relative ${open ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        title="Ask the Homepage AI Assistant"
        style={{ position: 'fixed', right: '16px', bottom: '96px' }}
      >
        <div className="relative">
          <Bot className="h-6 w-6" />
          <div className="absolute inset-0 rounded-full bg-[#39FF14] blur-xl opacity-15 animate-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-spin" style={{ animationDuration: '3s' }} />
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-[#39FF14]/10 via-transparent to-[#39FF14]/10 animate-spin" style={{ animationDuration: '2s' }} />
        </div>
        {!hasAutoIntroduced && (
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-rose-500 border-2 border-black animate-pulse" />
        )}
      </button>
      )}

      {open && !hideLauncher && (
        <div
          id="home-ai-panel"
          className="fixed z-50 right-0 sm:right-5 bottom-0 sm:bottom-6 w-full sm:w-[400px] h-[85dvh] sm:h-[580px] max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0a0a0a]/98 backdrop-blur-xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-gradient-to-r from-[#39FF14]/10 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#39FF14] to-emerald-600 flex items-center justify-center">
                <Bot className="h-5 w-5 text-black" />
              </div>
              <div>
                <h3 className="font-sans font-black text-sm text-white leading-none flex items-center gap-2">
                  All Kiki's AI
                  {isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-[#39FF14]" title="Admin recognized" />}
                </h3>
                <p className="text-[10px] text-neutral-500 mt-1">Voice Search + full site guide</p>
              </div>
            </div>
            <button id="close-home-ai-btn" onClick={() => setOpen(false)} className="text-neutral-500 hover:text-white cursor-pointer p-1">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-4">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-[#39FF14] text-black font-medium" : "bg-white/5 border border-white/10 text-neutral-200"
                  }`}
                >
                  {m.generatedImageUrl && <img src={m.generatedImageUrl} alt="AI Generated" className="rounded-xl mb-2 max-h-48 object-cover" />}
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#39FF14]" />
                  <span className="text-[10px] text-neutral-400">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
              {HOME_QUICK_PROMPTS.map((p) => (
                <button key={p} onClick={() => handleSend(p)} className="flex-shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-[10px] font-semibold px-3 py-2 rounded-xl cursor-pointer">
                  <MessageSquareText className="h-3 w-3 text-[#39FF14]" />
                  {p}
                </button>
              ))}
            </div>
          )}


          <div className="p-3 border-t border-white/10 flex items-center gap-2 bg-[#0a0a0a]/40">
            <button 
              onClick={toggleListening} 
              disabled={loading}
              className={`flex-shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center cursor-pointer disabled:opacity-40 transition-all ${
                isListening 
                  ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse' 
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400 hover:text-[#39FF14]'
              }`}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask anything about Cinemax..."
              className="flex-1 bg-white/5 border border-white/10 focus:border-[#39FF14]/50 focus:outline-none rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-600"
            />
            <button 
              onClick={() => setVoiceEnabled(!voiceEnabled)} 
              className={`flex-shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center cursor-pointer transition-all ${
                voiceEnabled 
                  ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]' 
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400 hover:text-white'
              }`}
              title={voiceEnabled ? "Voice enabled" : "Voice disabled"}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button onClick={() => handleSend()} disabled={loading || !input.trim()} className="flex-shrink-0 h-10 w-10 rounded-xl bg-[#39FF14] hover:brightness-110 disabled:opacity-40 flex items-center justify-center text-black cursor-pointer">
              <Send className="h-4 w-4" />
            </button>
          </div>
          <audio ref={audioRef} className="hidden" />
        </div>
      )}
    </>
  );
};

export default HomeAIAssistant;
