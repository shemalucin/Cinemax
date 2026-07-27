// Lightweight local declarations to avoid needing node_modules/@types for editor checks.

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module 'react' {
  const React: any;
  export = React;
  export const useState: any;
  export const useEffect: any;
  export const useRef: any;
  export const useCallback: any;
  export const useMemo: any;
  export const useContext: any;
  export const useReducer: any;
  export const FC: any;
  export const ChangeEvent: any;
}
declare module 'react-dom' {
  const ReactDOM: any;
  export = ReactDOM;
}
declare module 'lucide-react' {
  const icons: any;
  export = icons;
  export const Play: any;
  export const Volume2: any;
  export const VolumeX: any;
  export const Maximize: any;
  export const Settings: any;
  export const ChevronRight: any;
  export const Star: any;
  export const Search: any;
  export const Bell: any;
  export const Menu: any;
  export const Info: any;
  export const Bookmark: any;
  export const Heart: any;
  export const Download: any;
  export const Tv: any;
  export const X: any;
  export const Mic: any;
  export const Globe: any;
  export const Film: any;
  export const Sparkles: any;
  export const Camera: any;
  export const Scan: any;
  export const ArrowLeft: any;
  export const Share2: any;
  export const Users: any;
  export const BookmarkCheck: any;
  export const Check: any;
  export const Clock: any;
  export const ExternalLink: any;
  export const MessageSquare: any;
  export const Lock: any;
  export const Tag: any;
}
declare module 'hls.js' {
  const hls: any;
  export default hls;
}
declare module 'react/jsx-runtime' {
  const jsx: any;
  export = jsx;
}

declare module '*.css';
declare module '*.scss';

// Basic globals
declare var console: any;
declare var window: any;
declare var document: any;
declare var setTimeout: any;
declare var clearTimeout: any;
declare var setInterval: any;
declare var clearInterval: any;
declare namespace NodeJS {
  interface Timeout {
    ref(): any;
    unref(): any;
  }
}

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_ADMIN_PANEL_URL: string;
  readonly VITE_WEBSITE_URL: string;
  readonly VITE_YOUTUBE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
