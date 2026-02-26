import { create } from 'zustand';

interface ProjectUIState {
  openTabs: string[];
  activeTabId: string | null;
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
}

export const useProjectUIStore = create<ProjectUIState>((set, get) => ({
  openTabs: [],
  activeTabId: null,
  openTab: (id) => {
    const { openTabs } = get();
    if (!openTabs.includes(id)) {
      set({ openTabs: [...openTabs, id], activeTabId: id });
    } else {
      set({ activeTabId: id });
    }
  },
  closeTab: (id) => {
    const { openTabs, activeTabId } = get();
    const newTabs = openTabs.filter(t => t !== id);
    let newActive = activeTabId;
    if (activeTabId === id) {
      const idx = openTabs.indexOf(id);
      newActive = newTabs[Math.min(idx, newTabs.length - 1)] ?? null;
    }
    set({ openTabs: newTabs, activeTabId: newActive });
  },
  setActiveTab: (id) => set({ activeTabId: id }),
}));
