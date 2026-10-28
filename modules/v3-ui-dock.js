/**
 * SocialFlow V3 - Floating UI Dock & Navigation Hub
 * File: modules/v3-ui-dock.js
 */

(function (window) {
  'use strict';

  window.addEventListener('DOMContentLoaded', () => {
    // Tunggu registry SocialFlow siap
    setTimeout(() => {
      if (!window.SocialFlow || !window.SocialFlow.Core) return;

      const core = window.SocialFlow.Core;
      const switcher = core.Registry.get('project-switcher-ui');
      const team = core.Registry.get('team-collaboration');
      const scheduler = core.Registry.get('smart-scheduler');
      const ops = core.Registry.get('system-operations');

      // 1. Buat Kontainer Floating Dock
      const dockContainer = document.createElement('div');
      dockContainer.id = 'sf-v3-floating-dock';
      dockContainer.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-slate-900/95 text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 backdrop-blur-md transition-all select-none';

      // 2. Konten Visual Dock
      dockContainer.innerHTML = `
        <div class="flex items-center gap-2 pr-2 border-r border-slate-700">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="text-xs font-bold tracking-wider text-slate-300">SF V3</span>
        </div>

        <button id="btn-dock-project" class="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5" title="Switch Project">
          <span>📁</span>
          <span id="dock-current-project" class="font-medium">Project</span>
        </button>

        <button id="btn-dock-role" class="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5" title="Role Access">
          <span>🛡️</span>
          <span id="dock-current-role" class="font-medium">Owner</span>
        </button>

        <button id="btn-dock-quick" class="text-xs px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors flex items-center gap-1">
          <span>⚡</span> Hub
        </button>
      `;

      document.body.appendChild(dockContainer);

      // 3. Modal Panel Hub
      const modalBackdrop = document.createElement('div');
      modalBackdrop.id = 'sf-v3-hub-modal';
      modalBackdrop.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center hidden p-4 backdrop-blur-sm';
      modalBackdrop.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 text-white rounded-xl w-full max-w-md shadow-2xl p-6 relative">
          <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
            <h3 class="font-bold text-base flex items-center gap-2 text-indigo-400">
              <span>🚀</span> SocialFlow V3 Control Hub
            </h3>
            <button id="btn-close-hub" class="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1">GANTI PROYEK AKTIF</label>
              <div class="flex gap-2">
                <input id="input-new-project-id" type="text" placeholder="Masukkan Project ID..." class="w-full text-xs px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:border-indigo-500 text-white" />
                <button id="btn-save-project-id" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-md transition-colors">Set</button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1">SIMULASI ROLE / HAK AKSES</label>
              <select id="select-active-role" class="w-full text-xs px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:border-indigo-500 text-white">
                <option value="Owner">Owner (Akses Penuh)</option>
                <option value="Admin">Admin</option>
                <option value="Strategist">Strategist</option>
                <option value="Content Creator">Content Creator</option>
                <option value="Editor">Editor</option>
                <option value="Analyst">Analyst</option>
                <option value="Client Reviewer">Client Reviewer (Portal Klien)</option>
                <option value="Viewer">Viewer (Baca Saja)</option>
              </select>
            </div>

            <div class="pt-2 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <span id="hub-health-status">Status: Memeriksa...</span>
              <button id="btn-backup-data" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors">
                💾 Backup Data
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modalBackdrop);

      // 4. Sinkronisasi Data & Event Listener
      const updateDockUI = () => {
        const curProj = core.context.get().projectId || 'default-project';
        const curRole = team ? team.getCurrentRole() : 'Owner';

        const projLabel = document.getElementById('dock-current-project');
        const roleLabel = document.getElementById('dock-current-role');
        const roleSelect = document.getElementById('select-active-role');

        if (projLabel) projLabel.textContent = curProj;
        if (roleLabel) roleLabel.textContent = curRole;
        if (roleSelect) roleSelect.value = curRole;

        const healthEl = document.getElementById('hub-health-status');
        if (healthEl && ops) {
          const h = ops.getHealthStatus();
          healthEl.textContent = `Status: ${h.status}`;
          healthEl.className = h.status === 'OPERATIONAL' ? 'text-emerald-400 text-xs' : 'text-amber-400 text-xs';
        }
      };

      // Tampilkan/Tutup Modal
      const toggleHub = (show) => {
        modalBackdrop.classList.toggle('hidden', !show);
        if (show) updateDockUI();
      };

      document.getElementById('btn-dock-quick').addEventListener('click', () => toggleHub(true));
      document.getElementById('btn-dock-project').addEventListener('click', () => toggleHub(true));
      document.getElementById('btn-dock-role').addEventListener('click', () => toggleHub(true));
      document.getElementById('btn-close-hub').addEventListener('click', () => toggleHub(false));

      // Simpan Perubahan Proyek
      document.getElementById('btn-save-project-id').addEventListener('click', () => {
        const input = document.getElementById('input-new-project-id');
        const newProj = (input.value || '').trim();
        if (newProj && switcher) {
          switcher.switchProject(newProj);
          input.value = '';
          updateDockUI();
          toggleHub(false);
        }
      });

      // Simpan Perubahan Role
      document.getElementById('select-active-role').addEventListener('change', (e) => {
        if (team) {
          team.setCurrentRole(e.target.value);
          updateDockUI();
        }
      });

      // Tombol Backup
      document.getElementById('btn-backup-data').addEventListener('click', async () => {
        if (ops) {
          try {
            const b = await ops.createProjectDataBackup();
            const a = document.createElement('a');
            a.href = b.downloadUrl;
            a.download = `${b.backupId}.json`;
            a.click();
          } catch (err) {
            alert('Gagal membuat backup: ' + err.message);
          }
        }
      });

      // Inisialisasi awal
      updateDockUI();
    }, 1000);
  });
})(window);
