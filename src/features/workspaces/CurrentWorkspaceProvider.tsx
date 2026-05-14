import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "design-tracker:current-workspace";

type Ctx = {
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string | null) => void;
};

const CurrentWorkspaceContext = createContext<Ctx | undefined>(undefined);

export function CurrentWorkspaceProvider({ children }: { children: ReactNode }) {
  const [currentWorkspaceId, setState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  const setCurrentWorkspaceId = useCallback((id: string | null) => {
    setState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore quota / private-mode errors
    }
  }, []);

  return (
    <CurrentWorkspaceContext.Provider value={{ currentWorkspaceId, setCurrentWorkspaceId }}>
      {children}
    </CurrentWorkspaceContext.Provider>
  );
}

export function useCurrentWorkspaceId() {
  const ctx = useContext(CurrentWorkspaceContext);
  if (!ctx) throw new Error("useCurrentWorkspaceId must be used inside <CurrentWorkspaceProvider>");
  return ctx;
}
