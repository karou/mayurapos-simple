/// <reference types="react-scripts" />

// Extend Window interface to include global variables
interface Window {
    fs: {
      readFile: (filepath: string, options?: { encoding?: string }) => Promise<any>;
    };
  }
  
  // Extend NodeJS namespace for environment variables
  declare namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PUBLIC_URL: string;
      REACT_APP_API_URL?: string;
      REACT_APP_VERSION?: string;
    }
  }
  
  // SVG imports
  declare module '*.svg' {
    import * as React from 'react';
  
    export const ReactComponent: React.FunctionComponent<
      React.SVGProps<SVGSVGElement> & { title?: string }
    >;
  
    const src: string;
    export default src;
  }
  
  // Image imports
  declare module '*.png' {
    const content: string;
    export default content;
  }
  
  declare module '*.jpg' {
    const content: string;
    export default content;
  }
  
  declare module '*.jpeg' {
    const content: string;
    export default content;
  }
  
  declare module '*.gif' {
    const content: string;
    export default content;
  }
  
  // Add type definitions for service worker registration
  interface ServiceWorkerConfig {
    onSuccess?: (registration: ServiceWorkerRegistration) => void;
    onUpdate?: (registration: ServiceWorkerRegistration) => void;
  }