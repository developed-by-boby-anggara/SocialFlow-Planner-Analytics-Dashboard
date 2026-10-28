/**
 * SocialFlow V3 - Project Switcher UI Component
 * File: modules/project-switcher-ui.js
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  const ProjectSwitcherUIFactory = (core) => {
    const wm = core.Registry ? core.Registry.get('workspace-manager') : null;

    // Render function yang dapat dipasang di React container mana pun
    const renderSwitcher = (containerElement, onProjectChangeCallback) => {
      if (!containerElement || !window.React || !window.ReactDOM) return;

      const React = window.React;
      const { useState, useEffect } = React;

      const ProjectSwitcher = () => {
        const [projects, setProjects] = useState([]);
        const [active, setActive] = useState(null);
        const [isOpen, setIsOpen] = useState(false);
        const [showModal, setShowModal] = useState(false);
        const [newProjectName, setNewProjectName] = useState('');
        const [newProjectColor, setNewProjectColor] = useState('#0284c7');

        const refreshData = () => {
          if (!wm) return;
          setProjects(wm.getProjects());
          setActive(wm.getActiveProject());
        };

        useEffect(() => {
          refreshData();
          const unbind = core.events.on('project:changed', () => refreshData());
          return () => unbind();
        }, []);

        const handleSelect = (id) => {
          if (!wm) return;
          wm.selectProject(id);
          setIsOpen(false);
          refreshData();
          if (onProjectChangeCallback) onProjectChangeCallback(id);
        };

        const handleCreate = (e) => {
          e.preventDefault();
          if (!newProjectName.trim() || !wm) return;
          const created = wm.createProject({
            name: newProjectName,
            color: newProjectColor
          });
          wm.selectProject(created.id);
          setNewProjectName('');
          setShowModal(false);
          setIsOpen(false);
          refreshData();
          if (onProjectChangeCallback) onProjectChangeCallback(created.id);
        };

        if (!active) return null;

        return React.createElement('div', { className: 'relative inline-block text-left w-full' },
          // Tombol Trigger Dropdown
          React.createElement('button', {
            type: 'button',
            onClick: () => setIsOpen(!isOpen),
            className: 'w-full flex items-center justify-between px-3 py-2 bg-slate-900/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 transition-all shadow-sm'
          },
            React.createElement('div', { className: 'flex items-center space-x-2 truncate' },
              React.createElement('span', {
                className: 'w-2.5 h-2.5 rounded-full flex-shrink-0',
                style: { backgroundColor: active.color || '#0284c7' }
              }),
              React.createElement('span', { className: 'truncate max-w-[130px]' }, active.name)
            ),
            React.createElement('span', { className: 'text-slate-400 text-[10px] ml-1' }, isOpen ? '▲' : '▼')
          ),

          // Menu Dropdown
          isOpen && React.createElement('div', {
            className: 'absolute left-0 mt-1 w-56 rounded-xl shadow-2xl bg-slate-900 border border-slate-700 p-1.5 z-50 text-xs'
          },
            React.createElement('div', { className: 'px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400' }, 'Pilih Project / Klien'),
            projects.map(p => React.createElement('button', {
              key: p.id,
              onClick: () => handleSelect(p.id),
              className: `w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors ${p.id === active.id ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-300 hover:bg-slate-800'}`
            },
              React.createElement('div', { className: 'flex items-center space-x-2 truncate' },
                React.createElement('span', { className: 'w-2 h-2 rounded-full', style: { backgroundColor: p.color || '#0284c7' } }),
                React.createElement('span', { className: 'truncate' }, p.name)
              ),
              p.id === active.id && React.createElement('span', { className: 'text-sky-400 text-xs' }, '✓')
            )),
            React.createElement('div', { className: 'border-t border-slate-800 my-1' }),
            React.createElement('button', {
              onClick: () => { setIsOpen(false); setShowModal(true); },
              className: 'w-full text-left px-2.5 py-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 flex items-center space-x-1.5 font-medium'
            },
              React.createElement('span', null, '+'),
              React.createElement('span', null, 'Buat Project Baru')
            )
          ),

          // Modal Buat Project Baru
          showModal && React.createElement('div', {
            className: 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]'
          },
            React.createElement('div', { className: 'bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl' },
              React.createElement('h3', { className: 'text-sm font-bold text-white mb-1' }, 'Tambah Proyek / Klien Baru'),
              React.createElement('p', { className: 'text-xs text-slate-400 mb-4' }, 'Setiap proyek memiliki ruang kalender dan konten terpisah.'),
              React.createElement('form', { onSubmit: handleCreate },
                React.createElement('div', { className: 'mb-3' },
                  React.createElement('label', { className: 'block text-[11px] font-semibold text-slate-300 mb-1' }, 'Nama Proyek'),
                  React.createElement('input', {
                    type: 'text',
                    value: newProjectName,
                    onChange: (e) => setNewProjectName(e.target.value),
                    placeholder: 'Misal: Campaign Brand X, Akun TikTok B',
                    className: 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500'
                  })
                ),
                React.createElement('div', { className: 'mb-4' },
                  React.createElement('label', { className: 'block text-[11px] font-semibold text-slate-300 mb-1' }, 'Warna Identitas'),
                  React.createElement('div', { className: 'flex space-x-2' },
                    ['#0284c7', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'].map(c => React.createElement('button', {
                      key: c,
                      type: 'button',
                      onClick: () => setNewProjectColor(c),
                      className: `w-6 h-6 rounded-full border-2 ${newProjectColor === c ? 'border-white scale-110' : 'border-transparent'} transition-transform`,
                      style: { backgroundColor: c }
                    }))
                  )
                ),
                React.createElement('div', { className: 'flex justify-end space-x-2' },
                  React.createElement('button', {
                    type: 'button',
                    onClick: () => setShowModal(false),
                    className: 'px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white'
                  }, 'Batal'),
                  React.createElement('button', {
                    type: 'submit',
                    className: 'px-4 py-1.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20'
                  }, 'Simpan Proyek')
                )
              )
            )
          )
        );
      };

      window.ReactDOM.render(React.createElement(ProjectSwitcher), containerElement);
    };

    return { renderSwitcher };
  };

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('project-switcher-ui', ProjectSwitcherUIFactory, {
      name: 'Project Switcher UI Component',
      version: '1.0.0',
      dependencies: ['workspace-manager']
    });
  }
})(window);
