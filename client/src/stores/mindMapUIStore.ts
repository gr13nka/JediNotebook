import { create } from 'zustand';

interface MindMapUIState {
  activeMindMapId: string | null;
  selectedNodeId: string | null;
  mindUnloadActive: boolean;
  timerVisible: boolean;
  pendingEditNodeId: string | null;
  setActiveMindMap: (id: string | null) => void;
  setSelectedNode: (id: string | null) => void;
  setMindUnloadActive: (active: boolean) => void;
  setTimerVisible: (visible: boolean) => void;
  setPendingEditNode: (id: string | null) => void;
}

export const useMindMapUIStore = create<MindMapUIState>((set) => ({
  activeMindMapId: null,
  selectedNodeId: null,
  mindUnloadActive: false,
  timerVisible: false,
  pendingEditNodeId: null,
  setActiveMindMap: (id) => set({ activeMindMapId: id, selectedNodeId: null }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setMindUnloadActive: (active) => set({ mindUnloadActive: active }),
  setTimerVisible: (visible) => set({ timerVisible: visible }),
  setPendingEditNode: (id) => set({ pendingEditNodeId: id }),
}));
