/**
 * SocialFlow V3 - Project Switcher UI Component
 * File: modules/project-switcher-ui.js
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  const ProjectSwitcherUI = {
    init: function () {
      console.log('[SF-INFO][Registry] Modul [project-switcher-ui] aktif.');

      // 1. Baca preferensi proyek terakhir atau gunakan default
      let savedProject = 'default-project';
      try {
        savedProject = localStorage.getItem('sf_active_project_id') || 'default-project';
      } catch (e) {
        console.warn('Gagal membaca localStorage:', e);
      }

      if (SF.Core && SF.Core.context) {
        SF.Core.context.set({ projectId: savedProject });
      }

      // 2. Pasang elemen visual ke header
      const mount = () => this.mountSwitcher();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
      } else {
        setTimeout(mount, 300);
      }

      // 3. Tangani perubahan project dari modul lain
      if (SF.Core && SF.Core.events) {
        SF.Core.events.on('project:changed', (payload) => {
          if (payload && payload.projectId) {
            this.syncSelectUI(payload.projectId);
          }
        });
      }
    },

    mountSwitcher: function () {
      if (document.getElementById('sf-v3-project-switcher-wrapper')) return;

      // Cari area header aplikasi
      const headerTarget = document.querySelector('header .flex.items-center') ||
                           document.querySelector('header') ||
                           document.querySelector('nav');

      if (!headerTarget) {
        setTimeout(() => this.mountSwitcher(), 500);
        return;
      }

      const activeProject = (SF.Core && SF.Core.context.get().projectId) || 'default-project';

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
        selectEl.value = activeProject;
        selectEl.addEventListener('change', (e) => {
          this.handleProjectChange(e.target.value);
        });
      }
    },

    handleProjectChange: function (newProjectId) {
      if (!newProjectId) return;
      const prev = (SF.Core && SF.Core.context.get().projectId) || 'default-project';
      if (prev === newProjectId) return;

      try {
        localStorage.setItem('sf_active_project_id', newProjectId);
      } catch (e) {
        console.warn('Gagal menyimpan ke localStorage:', e);
      }

      if (SF.Core) {
        SF.Core.context.set({ projectId: newProjectId });
        SF.Core.events.emit('project:changed', {
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

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('project-switcher-ui', ProjectSwitcherUI);
  } else {
    window.addEventListener('load', () => {
      if (window.SocialFlow && window.SocialFlow.Core) {
        window.SocialFlow.Core.Registry.register('project-switcher-ui', ProjectSwitcherUI);
      }
    });
  }
})(window);
