import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TabType = 'feed' | 'swaps' | 'shifts' | 'roster' | 'profile';
export type ProfileSubTab = 'info' | 'settings' | 'billing';

interface UiState {
  // Client state: which tab is open (survives app restarts via persist).
  activeTab: TabType;
  profileSubTab: ProfileSubTab;
  // Which team the user is focused on (client selection, persisted for convenience).
  selectedTeamId: string | null;
  setActiveTab: (tab: TabType) => void;
  setProfileSubTab: (tab: ProfileSubTab) => void;
  setSelectedTeamId: (id: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeTab: 'shifts',
      profileSubTab: 'info',
      selectedTeamId: null,
      setActiveTab: (activeTab) => set({ activeTab }),
      setProfileSubTab: (profileSubTab) => set({ profileSubTab }),
      setSelectedTeamId: (selectedTeamId) => set({ selectedTeamId }),
    }),
    {
      name: 'rota-ui-state',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only durable UI preferences, not transient UI.
      partialize: (state) => ({
        activeTab: state.activeTab,
        profileSubTab: state.profileSubTab,
        selectedTeamId: state.selectedTeamId,
      }),
    }
  )
);
