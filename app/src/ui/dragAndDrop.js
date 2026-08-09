// Drag and Drop Workspace Layout Manager

function initDragAndDrop() {
  const panels = document.querySelectorAll('.panel');
  let draggedPanel = null;

  // 1. Initialize panels
  panels.forEach((panel, index) => {
    // Ensure every panel has an ID for serialization
    if (!panel.id) {
      panel.id = `panel-auto-${index}`;
    }
    
    // Make draggable (handled by applyUILockState)
    
    // Styling for drag visual feedback (handled by applyUILockState)

    // Drag Start
    panel.addEventListener('dragstart', (e) => {
      draggedPanel = panel;
      setTimeout(() => {
        panel.classList.add('dragging');
        panel.style.opacity = '0.5';
      }, 0);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', panel.id);
    });

    // Drag End
    panel.addEventListener('dragend', () => {
      draggedPanel.classList.remove('dragging');
      draggedPanel.style.opacity = '1';
      draggedPanel = null;
      saveLayout();
    });

    // Drag Over
    panel.addEventListener('dragover', (e) => {
      e.preventDefault(); // Necessary to allow dropping
      e.dataTransfer.dropEffect = 'move';
      const bounding = panel.getBoundingClientRect();
      const offset = bounding.y + (bounding.height / 2);
      if (e.clientY - offset > 0) {
        panel.style.borderBottom = '2px solid var(--color-primary)';
        panel.style.borderTop = '';
      } else {
        panel.style.borderTop = '2px solid var(--color-primary)';
        panel.style.borderBottom = '';
      }
    });

    // Drag Leave
    panel.addEventListener('dragleave', (e) => {
      panel.style.borderBottom = '';
      panel.style.borderTop = '';
    });

    // Drop
    panel.addEventListener('drop', (e) => {
      e.preventDefault();
      panel.style.borderBottom = '';
      panel.style.borderTop = '';
      
      if (draggedPanel && draggedPanel !== panel) {
        // Determine insertion position based on mouse position relative to target
        const bounding = panel.getBoundingClientRect();
        const offset = bounding.y + (bounding.height / 2);
        
        if (e.clientY - offset > 0) {
          panel.parentNode.insertBefore(draggedPanel, panel.nextSibling);
        } else {
          panel.parentNode.insertBefore(draggedPanel, panel);
        }
      }
    });
  });

  // Load layout immediately
  loadLayout();

  // Apply UI lock state
  if (window.applyUILockState) {
    window.applyUILockState();
  }
}

function saveLayout() {
  const layout = {};
  // Find all grid/column containers
  const containers = document.querySelectorAll('.side-stack, .main-content, .right-rail');
  
  containers.forEach(container => {
    // Only save containers that actually have panels
    if (container.querySelectorAll('.panel').length === 0 && !container.classList.contains('main-content')) return;
    
    // Generate an ID for the container if it doesn't have one
    let containerId = container.id || container.className.split(' ')[0];
    
    // Get ordered list of panel IDs in this container
    const panelIds = Array.from(container.querySelectorAll('.panel')).map(p => p.id);
    layout[containerId] = panelIds;
  });

  localStorage.setItem('riverline_layout', JSON.stringify(layout));
}

function loadLayout() {
  const saved = localStorage.getItem('riverline_layout');
  if (!saved) return;

  try {
    const layout = JSON.parse(saved);
    
    for (const [containerId, panelIds] of Object.entries(layout)) {
      // Find container by class or ID
      const container = document.getElementById(containerId) || document.querySelector(`.${containerId}`);
      if (!container) continue;

      // Reorder panels
      panelIds.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel && panel.parentNode) {
          // Move the panel to the end of this container
          container.appendChild(panel);
        }
      });
    }
  } catch (e) {
    console.error('Failed to load custom layout', e);
  }
}

// Execute init on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDragAndDrop);
} else {
  initDragAndDrop();
}

window.initDragAndDrop = initDragAndDrop;

window.uiLocked = localStorage.getItem('riverline_ui_locked') !== 'false';
window.applyUILockState = function() {
  const btn = document.getElementById('lockUiBtn');
  if (btn) btn.textContent = window.uiLocked ? '🔒' : '🔓';
  const panels = document.querySelectorAll('.panel');
  panels.forEach(panel => {
    if (window.uiLocked) {
      panel.removeAttribute('draggable');
      panel.style.cursor = 'default';
    } else {
      panel.setAttribute('draggable', 'true');
      panel.style.cursor = 'grab';
    }
  });
};

window.toggleUILock = function() {
  window.uiLocked = !window.uiLocked;
  localStorage.setItem('riverline_ui_locked', window.uiLocked);
  window.applyUILockState();
};
