import { describe, it, expect, beforeEach } from 'vitest'
import { useKeybindingsStore } from '../keybindings-store'

describe('Keybindings Store', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useKeybindingsStore.getState().resetToDefaults()
  })

  describe('Default Keybindings', () => {
    it('should include Enter key mapping to goto-start action', () => {
      const { keybindings } = useKeybindingsStore.getState()
      expect(keybindings.enter).toBe('goto-start')
    })

    it('should include Home key mapping to goto-start action', () => {
      const { keybindings } = useKeybindingsStore.getState()
      expect(keybindings.home).toBe('goto-start')
    })

    it('should have both Enter and Home keys for the same action', () => {
      const { keybindings } = useKeybindingsStore.getState()
      expect(keybindings.enter).toBe(keybindings.home)
    })
  })

  describe('getKeybindingsForAction', () => {
    it('should return both Enter and Home keys for goto-start action', () => {
      const { getKeybindingsForAction } = useKeybindingsStore.getState()
      const keys = getKeybindingsForAction('goto-start')
      
      expect(keys).toContain('enter')
      expect(keys).toContain('home')
      expect(keys.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Keyboard Event Parsing', () => {
    it('should generate correct keybinding string for Enter key', () => {
      const { getKeybindingString } = useKeybindingsStore.getState()
      
      // Mock KeyboardEvent for Enter key
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter'
      })
      
      const result = getKeybindingString(enterEvent)
      expect(result).toBe('enter')
    })

    it('should generate correct keybinding string for Home key', () => {
      const { getKeybindingString } = useKeybindingsStore.getState()
      
      // Mock KeyboardEvent for Home key
      const homeEvent = new KeyboardEvent('keydown', {
        key: 'Home',
        code: 'Home'
      })
      
      const result = getKeybindingString(homeEvent)
      expect(result).toBe('home')
    })
  })
})