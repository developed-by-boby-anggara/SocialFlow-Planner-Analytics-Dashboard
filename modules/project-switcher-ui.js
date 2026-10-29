/**
 * SocialFlow V3 - Dynamic Project & Agency Switcher Module
 * File: modules/project-switcher-ui.js
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  const ProjectSwitcherUIFactory = (core) => {
    return {
      projects: [],

      init: function () {
        console.log('[SF-INFO][Registry] Modul [project-switcher-ui] dynamic agency aktif.');
        this.loadProjects();

        let activeProj = localStorage.getItem('sf_active_project_id') || 'default-project';
        if (core && core.context && typeof core.context.set === 'function') {
          core.context.set({ projectId: activeProj });
        }

        const mount = () => {
          this.mountModal();
          this.syncDropdownOptions();
        };

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', mount);
        } else {
          setTimeout(mount, 300);
        }

        window.addEventListener('project:changed', (e) => {
          const pid = e.detail?.projectId || e.projectId;
          if (pid) this.syncSelectValue(pid);
        });
      },

      loadProjects: function () {
        const defaultList = [
          { id: 'default-project', name: 'Main Agency (Default)', type: 'Agency' },
          { id: 'agency-a', name: 'Agency A (Fashion Brand)', type: 'Agency' },
          { id: 'klien-b', name: 'Klien B (Personal Creator)', type: 'Personal' }
        ];

        try {
          const saved = localStorage.getItem('sf_custom_projects');
          this.projects = saved ? JSON.parse(saved) : defaultList;
        } catch (e) {
          this.projects = defaultList;
        }
      },

      saveProjects: function () {
        localStorage.setItem('sf_custom_projects', JSON.stringify(this.projects));
        this.syncDropdownOptions();
      },

      syncDropdownOptions: function () {
        const selectEls = document.querySelectorAll('select#sf-project-select-dynamic, select[value]');
        let activeProj = localStorage.getItem('sf_active_project_id') || 'default-project';

        selectEls.forEach((sel) => {
          // Cari select yang mengelola project
          if (!sel.innerHTML.includes('Default Project') && sel.id !== 'sf-project-select-dynamic') return;

          sel.id = 'sf-project-select-dynamic';
          sel.innerHTML = '';

          this.projects.forEach((p) => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `🏢 ${p.name} (${p.type || 'Agency'})`;
            opt.className = 'bg-slate-900 text-white';
            sel.appendChild(opt);
          });

          // Tambah opsi Trigger Modal di baris paling bawah
          const addOpt = document.createElement('option');
          addOpt.value = '__CREATE_NEW_AGENCY__';
          addOpt.textContent = '➕ + Tambah Agency / Project Baru...';
          addOpt.className = 'bg-indigo-950 text-indigo-300 font-bold';
          sel.appendChild(addOpt);

          sel.value = activeProj;

          sel.onchange = (e) => {
            if (e.target.value === '__CREATE_NEW_AGENCY__') {
              sel.value = activeProj; // kembalikan value agar tidak terpilih
              this.openModal();
            } else {
              activeProj = e.target.value;
              localStorage.setItem('sf_active_project_id', activeProj);

              if (core && core.context && typeof core.context.set === 'function') {
                core.context.set({ projectId: activeProj });
              }
              if (core && core.events && typeof core.events.emit === 'function') {
                core.events.emit('project:changed', { projectId: activeProj });
              }
              window.dispatchEvent(new CustomEvent('project:changed', { detail: { projectId: activeProj } }));
            }
          };
        });
      },

      syncSelectValue: function (projectId) {
        const sel = document.getElementById('sf-project-select-dynamic');
        if (sel && sel.value !== projectId) {
          sel.value = projectId;
        }
      },

      mountModal: function () {
        if (document.getElementById('sf-agency-modal-root')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'sf-agency-modal-root';
        modalDiv.className = 'fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] hidden items-center justify-center p-4';

        modalDiv.innerHTML = `
          <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-slate-800">
            <div class="flex justify-between items-center mb-4">
              <div>
                <h3 class="font-extrabold text-base text-slate-900">Tambah Agency / Client Baru</h3>
                <p class="text-xs text-slate-500">Kelola workspace terpisah untuk setiap klien atau brand.</p>
              </div>
              <button id="sf-agency-close-btn" class="text-slate-400 hover:text-slate-700 font-bold text-lg">✕</button>
            </div>
            
            <form id="sf-agency-form" class="space-y-3.5 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Nama Agency / Klien</label>
                <input type="text" id="sf-agency-name-input" required placeholder="Contoh: Agency Wardah, Klien Boby Creator" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Tipe Entitas</label>
                <select id="sf-agency-type-input" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-semibold focus:outline-none">
                  <option value="Agency">Agency</option>
                  <option value="Personal Brand">Personal Brand / Influencer</option>
                  <option value="Korporat / UMKM">Korporat / Brand UMKM</option>
                </select>
              </div>

              <div class="flex justify-end gap-2 pt-3">
                <button type="button" id="sf-agency-cancel-btn" class="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50">Batal</button>
                <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-600/30">Simpan Agency</button>
              </div>
            </form>
          </div>
        `;

        document.body.appendChild(modalDiv);

        // Event listener close
        const close = () => modalDiv.classList.replace('flex', 'hidden');
        document.getElementById('sf-agency-close-btn').onclick = close;
        document.getElementById('sf-agency-cancel-btn').onclick = close;

        // Submit form
        document.getElementById('sf-agency-form').onsubmit = (e) => {
          e.preventDefault();
          const name = document.getElementById('sf-agency-name-input').value.trim();
          const type = document.getElementById('sf-agency-type-input').value;
          if (!name) return;

          const newId = 'proj-' + Date.now();
          const newProject = { id: newId, name: name, type: type };

          this.projects.push(newProject);
          this.saveProjects();

          // Otomatis pindah ke agency baru
          localStorage.setItem('sf_active_project_id', newId);
          window.dispatchEvent(new CustomEvent('project:changed', { detail: { projectId: newId } }));

          close();
          document.getElementById('sf-agency-form').reset();
        };
      },

      openModal: function () {
        const modal = document.getElementById('sf-agency-modal-root');
        if (modal) {
          modal.classList.replace('hidden', 'flex');
          document.getElementById('sf-agency-name-input')?.focus();
        }
      }
    };
  };

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('project-switcher-ui', ProjectSwitcherUIFactory);
  }
})(window);
