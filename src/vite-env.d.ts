/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Where the recipe box is read from. Unset: this browser's localStorage.
  readonly VITE_RECIPES_API?: string;
}

interface Window {
  nextThyme?: {
    ping: () => Promise<string>;
  };
}
