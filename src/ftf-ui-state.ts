import type { Sender } from './conversation-model';

export type FtfUiState = {
  activeTyping: Sender | 'none';
  partnerKeyboardOpen: boolean;
};

export type FtfUiAction =
  | { type: 'focus-input'; sender: Sender }
  | { type: 'open-phrases'; sender: Sender }
  | { type: 'expand-collapsed'; sender: Sender }
  | { type: 'restore-split' };

export const initialFtfUiState: FtfUiState = {
  activeTyping: 'none',
  partnerKeyboardOpen: false,
};

export function reduceFtfUiState(state: FtfUiState, action: FtfUiAction): FtfUiState {
  switch (action.type) {
    case 'focus-input':
      return { activeTyping: action.sender, partnerKeyboardOpen: action.sender === 'partner' };
    case 'open-phrases':
      return { activeTyping: action.sender, partnerKeyboardOpen: false };
    case 'expand-collapsed':
      return { activeTyping: action.sender, partnerKeyboardOpen: action.sender === 'partner' };
    case 'restore-split':
      return initialFtfUiState;
  }
}
