// Lightweight local JSX declarations so the admin app compiles in editors
// even when `node_modules/@types/react` is not installed.

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

// Allow importing CSS modules without types
declare module '*.css';
declare module '*.scss';
declare module '*.module.css';
declare module '*.module.scss';

declare module 'react' {
  const React: any;
  export = React;
}
declare module 'react-dom' {
  const ReactDOM: any;
  export = ReactDOM;
}
declare module 'lucide-react' {
  const icons: any;
  export = icons;
}
declare module 'react/jsx-runtime' {
  const jsx: any;
  export = jsx;
}
