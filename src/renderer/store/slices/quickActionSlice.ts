import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LocalizedQuickAction } from '../../types/quickAction';

interface QuickActionState {
  /**   */
  actions: LocalizedQuickAction[];
  /**   action ID */
  selectedActionId: string | null;
  /**   prompt ID */
  selectedPromptId: string | null;
  /**   */
  isLoading: boolean;
}

const initialState: QuickActionState = {
  actions: [],
  selectedActionId: null,
  selectedPromptId: null,
  isLoading: false,
};

const quickActionSlice = createSlice({
  name: 'quickAction',
  initialState,
  reducers: {
    /**   */
    setActions: (state, action: PayloadAction<LocalizedQuickAction[]>) => {
      state.actions = action.payload;
    },
    /**   */
    selectAction: (state, action: PayloadAction<string | null>) => {
      state.selectedActionId = action.payload;
      //   action   prompt  
      state.selectedPromptId = null;
    },
    /**   */
    selectPrompt: (state, action: PayloadAction<string | null>) => {
      state.selectedPromptId = action.payload;
    },
    /**   */
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    /**   */
    clearSelection: (state) => {
      state.selectedActionId = null;
      state.selectedPromptId = null;
    },
  },
});

export const {
  setActions,
  selectAction,
  selectPrompt,
  setLoading,
  clearSelection,
} = quickActionSlice.actions;

export default quickActionSlice.reducer;
