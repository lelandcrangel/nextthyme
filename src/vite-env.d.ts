/// <reference types="vite/client" />

interface Window {
  nextThyme?: {
    ping: () => Promise<string>;
  };
}
