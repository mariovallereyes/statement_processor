import React, { useEffect, useCallback, useState } from 'react';
import './KeyboardShortcuts.css';

export interface ShortcutAction {
  id: string;
  keys: string[];
  description: string;
  action: () => void;
  category?: string;
  disabled?: boolean;
}

interface KeyboardShortcutsProps {
  shortcuts: ShortcutAction[];
  disabled?: boolean;
  showHelp?: boolean;
  onToggleHelp?: (show: boolean) => void;
}

interface ShortcutHelpProps {
  shortcuts: ShortcutAction[];
  onClose: () => void;
  isVisible: boolean;
}

const ShortcutHelp: React.FC<ShortcutHelpProps> = ({ shortcuts, onClose, isVisible }) => {
  const groupedShortcuts = shortcuts.reduce((groups, shortcut) => {
    const category = shortcut.category || 'General';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(shortcut);
    return groups;
  }, {} as Record<string, ShortcutAction[]>);

  const formatKeys = (keys: string[]): string => {
    return keys.map(key => {
      // Convert common key names to display format
      const keyMap: Record<string, string> = {
        'Meta': '⌘',
        'Control': 'Ctrl',
        'Alt': 'Alt',
        'Shift': '⇧',
        'Enter': '↵',
        'Escape': 'Esc',
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'ArrowLeft': '←',
        'ArrowRight': '→',
        'Backspace': '⌫',
        'Delete': '⌦',
        'Tab': '⇥',
        'Space': 'Space'
      };
      return keyMap[key] || key.toUpperCase();
    }).join(' + ');
  };

  if (!isVisible) return null;

  return (
    <div 
      className="shortcut-help-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-help-title"
    >
      <div 
        className="shortcut-help-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcut-help-header">
          <h2 id="shortcut-help-title">Keyboard Shortcuts</h2>
          <button 
            className="shortcut-help-close"
            onClick={onClose}
            aria-label="Close keyboard shortcuts help"
          >
            ✕
          </button>
        </div>
        
        <div className="shortcut-help-content">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="shortcut-category">
              <h3 className="shortcut-category-title">{category}</h3>
              <div className="shortcut-list">
                {categoryShortcuts.map((shortcut) => (
                  <div 
                    key={shortcut.id} 
                    className={`shortcut-item ${shortcut.disabled ? 'disabled' : ''}`}
                  >
                    <div className="shortcut-keys">
                      {formatKeys(shortcut.keys)}
                    </div>
                    <div className="shortcut-description">
                      {shortcut.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="shortcut-help-footer">
          <p>Press <kbd>?</kbd> or <kbd>F1</kbd> to toggle this help</p>
        </div>
      </div>
    </div>
  );
};

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  shortcuts,
  disabled = false,
  showHelp = false,
  onToggleHelp
}) => {
  const [helpVisible, setHelpVisible] = useState(showHelp);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  const toggleHelp = useCallback(() => {
    const newVisible = !helpVisible;
    setHelpVisible(newVisible);
    onToggleHelp?.(newVisible);
  }, [helpVisible, onToggleHelp]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled) return;

    const key = event.key;
    const newPressedKeys = new Set(pressedKeys);
    newPressedKeys.add(key);
    setPressedKeys(newPressedKeys);

    // Check for help toggle shortcuts
    if (key === '?' || key === 'F1') {
      event.preventDefault();
      toggleHelp();
      return;
    }

    // Check if Escape should close help
    if (key === 'Escape' && helpVisible) {
      event.preventDefault();
      setHelpVisible(false);
      onToggleHelp?.(false);
      return;
    }

    // Build current key combination
    const currentKeys: string[] = [];
    if (event.metaKey) currentKeys.push('Meta');
    if (event.ctrlKey) currentKeys.push('Control');
    if (event.altKey) currentKeys.push('Alt');
    if (event.shiftKey) currentKeys.push('Shift');
    
    // Add the main key if it's not a modifier
    if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
      currentKeys.push(key);
    }

    // Find matching shortcut
    const matchingShortcut = shortcuts.find(shortcut => {
      if (shortcut.disabled) return false;
      
      // Check if the key combinations match
      if (shortcut.keys.length !== currentKeys.length) return false;
      
      return shortcut.keys.every(shortcutKey => 
        currentKeys.includes(shortcutKey)
      );
    });

    if (matchingShortcut) {
      event.preventDefault();
      event.stopPropagation();
      matchingShortcut.action();
    }
  }, [disabled, shortcuts, helpVisible, pressedKeys, toggleHelp, onToggleHelp]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const newPressedKeys = new Set(pressedKeys);
    newPressedKeys.delete(event.key);
    setPressedKeys(newPressedKeys);
  }, [pressedKeys]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Update help visibility when prop changes
  useEffect(() => {
    setHelpVisible(showHelp);
  }, [showHelp]);

  return (
    <ShortcutHelp 
      shortcuts={shortcuts}
      onClose={() => {
        setHelpVisible(false);
        onToggleHelp?.(false);
      }}
      isVisible={helpVisible}
    />
  );
};