import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcutsHelp } from '../use-keyboard-shortcuts-help'
import { useKeybindingsStore } from '../../stores/keybindings-store'

describe('useKeyboardShortcutsHelp', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useKeybindingsStore.getState().resetToDefaults()
  })

  it('should format Enter key correctly in shortcuts', () => {
    const { result } = renderHook(() => useKeyboardShortcutsHelp())
    
    // Find the goto-start action in shortcuts
    const gotoStartShortcut = result.current.shortcuts.find(
      shortcut => shortcut.action === 'goto-start'
    )
    
    expect(gotoStartShortcut).toBeDefined()
    expect(gotoStartShortcut?.keys).toContain('Enter')
    expect(gotoStartShortcut?.keys).toContain('Home')
  })

  it('should include goto-start action with correct description', () => {
    const { result } = renderHook(() => useKeyboardShortcutsHelp())
    
    const gotoStartShortcut = result.current.shortcuts.find(
      shortcut => shortcut.action === 'goto-start'
    )
    
    expect(gotoStartShortcut).toBeDefined()
    expect(gotoStartShortcut?.description).toBe('Go to timeline start')
    expect(gotoStartShortcut?.category).toBe('Navigation')
  })

  it('should have multiple keys for goto-start action', () => {
    const { result } = renderHook(() => useKeyboardShortcutsHelp())
    
    const gotoStartShortcut = result.current.shortcuts.find(
      shortcut => shortcut.action === 'goto-start'
    )
    
    expect(gotoStartShortcut?.keys.length).toBeGreaterThanOrEqual(2)
  })
})