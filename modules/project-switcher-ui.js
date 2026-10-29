/**
 * SocialFlow V3 - Project Switcher UI Module
 * File: modules/project-switcher-ui.js
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  // Modul SocialFlow V3 didaftarkan sebagai Factory Function yang menerima (core)
  const ProjectSwitcherUIFactory = (core) => {
    return {
      init: function () {
        console.log('[SF-INFO][Registry] Modul [project-switcher-ui] berhasil dimuat.');

        let savedProject = 'default-project';
        try {
          savedProject = localStorage.getItem('sf_active_project_id') || 'default-project';
        } catch (e) {
          console.warn('Gagal membaca localStorage:', e);
        }

        if (core && core.context && typeof core.context.set === 'function') {
          core.context.set({ projectId: savedProject });
        }

        const mount = () => this.mountSwitcher();
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', mount);
        } else {
          setTimeout(mount, 300);
        }

        if (core && core.events && typeof core.events.on === 'function') {
          core.events.on('project:changed', (payload) => {
            if (payload && payload.projectId) {
              this.syncSelectUI(payload.projectId);
            }
          });
        }
      },

      mountSwitcher: function () {
        if (document.getElementById('sf-v3-project-switcher-wrapper')) return;

        const headerTarget = document.querySelector('header .flex.items-center') ||
                             document.querySelector('header') ||
                             document.querySelector('nav');

        if (!headerTarget) {
          setTimeout(() => this.mountSwitcher(), 500);
          return;
        }

        let activeProj = 'default-project';
        if (core && core.context && typeof core.context.get === 'function') {
          activeProj = core.context.get().projectId || 'default-project';
        }

        const wrapper = document.createElement('div');
        wrapper.id = 'sf-v3-project-switcher-wrapper';
        wrapper.className = 'relative inline-flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1 rounded-lg shadow-sm text-xs text-slate-200 mr-2';

        wrapper.innerHTML = `
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Active Project"></span>
          <span class="hidden sm:inline font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Project:</span>
          <select id="sf-v3-project-select" class="bg-transparent border-none text-white font-medium text-xs focus:ring-0 focus:outline-none cursor-pointer pr-1">
            <option value="default-project" class="bg-slate-900 text-white">Default Project</option>
            <option value="project-alpha" class="bg-slate-900 text-white">Project Alpha</option>
            <option value="project-beta" class="bg-slate-900 text-white">Project Beta</option>
          </select>
        `;

        headerTarget.appendChild(wrapper);

        const selectEl = document.getElementById('sf-v3-project-select');
        if (selectEl) {
          selectEl.value = activeProj;
          selectEl.addEventListener('change', (e) => {
            this.handleProjectChange(e.target.value);
          });
        }
      },

      handleProjectChange: function (newProjectId) {
        if (!newProjectId) return;
        let prev = 'default-project';
        if (core && core.context && typeof core.context.get === 'function') {
          prev = core.context.get().projectId || 'default-project';
        }
        if (prev === newProjectId) return;

        try {
          localStorage.setItem('sf_active_project_id', newProjectId);
        } catch (e) {
          console.warn('Gagal menyimpan ke localStorage:', e);
        }

        if (core && core.context && typeof core.context.set === 'function') {
          core.context.set({ projectId: newProjectId });
        }
        if (core && core.events && typeof core.events.emit === 'function') {
          core.events.emit('project:changed', {
            projectId: newProjectId,
            previousProjectId: prev
          });
        }
      },

      syncSelectUI: function (projectId) {
        const selectEl = document.getElementById('sf-v3-project-select');
        if (selectEl && selectEl.value !== projectId) {
          let opt = selectEl.querySelector(`option[value="${projectId}"]`);
          if (!opt) {
            opt = document.createElement('option');
            opt.value = projectId;
            opt.textContent = projectId;
            opt.className = 'bg-slate-900 text-white';
            selectEl.appendChild(opt);
          }
          selectEl.value = projectId;
        }
      }
    };
  };

  // Daftarkan factory function ke Registry
  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('project-switcher-ui', ProjectSwitcherUIFactory);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      if (window.SocialFlow && window.SocialFlow.Core && window.SocialFlow.Core.Registry) {
        window.SocialFlow.Core.Registry.register('project-switcher-ui', ProjectSwitcherUIFactory);
      }
    });
  }
})(window);
