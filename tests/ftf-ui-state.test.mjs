import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialFtfUiState, reduceFtfUiState } from '../src/ftf-ui-state.ts';

test('opening quick phrases expands the requested pane without opening the partner keyboard', () => {
  for (const sender of ['you', 'partner']) {
    const state = reduceFtfUiState(initialFtfUiState, { type: 'open-phrases', sender });
    assert.deepEqual(state, { activeTyping: sender, partnerKeyboardOpen: false });
  }
});

test('partner input and collapsed-bar expansion keep the existing keyboard behavior', () => {
  assert.deepEqual(
    reduceFtfUiState(initialFtfUiState, { type: 'focus-input', sender: 'partner' }),
    { activeTyping: 'partner', partnerKeyboardOpen: true },
  );
  assert.deepEqual(
    reduceFtfUiState(initialFtfUiState, { type: 'expand-collapsed', sender: 'partner' }),
    { activeTyping: 'partner', partnerKeyboardOpen: true },
  );
});

test('restoring the split closes the partner keyboard and clears the expanded pane', () => {
  const open = { activeTyping: 'partner', partnerKeyboardOpen: true };
  assert.deepEqual(reduceFtfUiState(open, { type: 'restore-split' }), initialFtfUiState);
});
