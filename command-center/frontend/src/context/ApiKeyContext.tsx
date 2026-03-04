"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface ApiKeyContextType {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  isKeySet: boolean;
  backendHasKey: boolean;
}

const ApiKeyContext = createContext<ApiKeyContextType>({
  apiKey: null,
  setApiKey: () => {},
  clearApiKey: () => {},
  isKeySet: false,
  backendHasKey: false,
});

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [backendHasKey, setBackendHasKey] = useState(false);

  // Check if backend has an API key configured on mount
  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${API}/health`)
      .then((res) => res.json())
      .then((data) => {
        if (data.api_key_configured) {
          setBackendHasKey(true);
          // Set a sentinel value so isKeySet returns true
          // The backend will use its own key; the frontend just needs to know it's available
          setApiKeyState("__backend__");
        }
      })
      .catch(() => {
        // Backend not reachable yet, that's fine
      });
  }, []);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
  }, []);

  const clearApiKey = useCallback(() => {
    setApiKeyState(null);
  }, []);

  return (
    <ApiKeyContext.Provider
      value={{
        apiKey,
        setApiKey,
        clearApiKey,
        isKeySet: apiKey !== null,
        backendHasKey,
      }}
    >
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKey() {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error("useApiKey must be used within an ApiKeyProvider");
  }
  return context;
}
