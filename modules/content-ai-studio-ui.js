/**
 * SocialFlow V3 - Content AI Studio UI Drawer
 * File: modules/content-ai-studio-ui.js
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  const ContentAIUIFactory = (core) => {
    const aiModule = core.Registry ? core.Registry.get('content-ai') : null;
    const wm = core.Registry ? core.Registry.get('workspace-manager') : null;

    const renderStudioModal = (containerElement, onSavedCallback) => {
      if (!containerElement || !window.React || !window.ReactDOM) return;

      const React = window.React;
      const { useState, useEffect } = React;

      const StudioDrawer = () => {
        const [isOpen, setIsOpen] = useState(false);
        const [topic, setTopic] = useState('');
        const [platform, setPlatform] = useState('Instagram');
        const [format, setFormat] = useState('Video Reels');
        const [objective, setObjective] = useState('awareness');
        const [result, setResult] = useState(null);
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [statusMessage, setStatusMessage] = useState('');

        const handleGenerate = (e) => {
          e.preventDefault();
          if (!topic.trim() || !aiModule) return;
          const output = aiModule.generateStudioContent({
            topic,
            platform,
            format,
            objective
          });
          setResult(output);
          setStatusMessage('Draft naskah berhasil di-generate!');
        };

        const handleSendToPlanner = async () => {
          if (!result || !aiModule) return;
          setIsSubmitting(true);
          const res = await aiModule.sendToPlanner(result);
          setIsSubmitting(false);
          if (res && res.success) {
            setStatusMessage('✓ Berhasil dikirim ke Bank Ide Planner!');
            if (onSavedCallback) onSavedCallback();
            setTimeout(() => {
              setIsOpen(false);
              setResult(null);
              setTopic('');
              setStatusMessage('');
            }, 1200);
          } else {
            setStatusMessage('Gagal menyimpan ke planner.');
          }
        };

        return React.createElement('div', null,
          React.createElement('button', {
            type: 'button',
            onClick: () => setIsOpen(true),
            className: 'flex items-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all'
          },
            React.createElement('span', null, '✨'),
            React.createElement('span', null, 'AI Content Studio')
          ),

          isOpen && React.createElement('div', {
            className: 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]'
          },
            React.createElement('div', {
              className: 'bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden'
            },
              React.createElement('div', { className: 'px-6 py-4 border-b border-slate-800 flex items-center justify-between' },
                React.createElement('div', null,
                  React.createElement('h3', { className: 'text-sm font-bold text-white flex items-center space-x-2' },
                    React.createElement('span', null, '✨ AI Content Studio & Brand Intelligence'),
                    React.createElement('span', { className: 'text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full' }, 'V3 Engine')
                  ),
                  React.createElement('p', { className: 'text-[11px] text-slate-400 mt-0.5' }, 'Rancang hook, draft video, dan carousel sesuai target audiens.')
                ),
                React.createElement('button', {
                  onClick: () => setIsOpen(false),
                  className: 'text-slate-400 hover:text-white text-base'
                }, '✕')
              ),

              React.createElement('div', { className: 'p-6 overflow-y-auto space-y-4' },
                React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-3' },
                  React.createElement('div', null,
                    React.createElement('label', { className: 'block text-[11px] font-semibold text-slate-300 mb-1' }, 'Platform'),
                    React.createElement('select', {
                      value: platform,
                      onChange: (e) => setPlatform(e.target.value),
                      className: 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white'
                    },
                      ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Pinterest'].map(p => React.createElement('option', { key: p, value: p }, p))
                    )
                  ),
                  React.createElement('div', null,
                    React.createElement('label', { className: 'block text-[11px] font-semibold text-slate-300 mb-1' }, 'Format'),
                    React.createElement('select', {
                      value: format,
                      onChange: (e) => setFormat(e.target.value),
                      className: 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white'
                    },
                      ['Video Reels', 'TikTok Video', 'Carousel', 'Postingan Foto', 'Story'].map(f => React.createElement('option', { key: f, value: f }, f))
                    )
                  ),
                  React.createElement('div', null,
                    React.createElement('label', { className: 'block text-[11px] font-semibold text-slate-300 mb-1' }, 'Tujuan Konten'),
                    React.createElement('select', {
                      value: objective,
                      onChange: (e) => setObjective(e.target.value),
                      className: 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white'
                    },
                      ['awareness', 'engagement', 'conversion', 'edukasi'].map(o => React.createElement('option', { key: o, value: o }, o.toUpperCase()))
                    )
                  )
                ),

                React.createElement('div', null,
                  React.createElement('label', { className: 'block text-[11px] font-semibold text-slate-300 mb-1' }, 'Topik / Niche Bahasan'),
                  React.createElement('input', {
                    type: 'text',
                    value: topic,
                    onChange: (e) => setTopic(e.target.value),
                    placeholder: 'Misal: 3 Kesalahan Mix and Match Warna Baju Kuliah',
                    className: 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500'
                  })
                ),

                React.createElement('div', { className: 'flex justify-end' },
                  React.createElement('button', {
                    type: 'button',
                    onClick: handleGenerate,
                    className: 'px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors'
                  }, 'Generate Naskah & Hook')
                ),

                result && React.createElement('div', { className: 'mt-4 p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3' },
                  React.createElement('div', null,
                    React.createElement('span', { className: 'text-[10px] uppercase font-bold text-violet-400' }, 'Hook 3 Detik:'),
                    React.createElement('p', { className: 'text-xs font-semibold text-white mt-0.5' }, result.hook)
                  ),
                  React.createElement('div', null,
                    React.createElement('span', { className: 'text-[10px] uppercase font-bold text-slate-400' }, 'Outline Naskah:'),
                    React.createElement('pre', { className: 'text-xs text-slate-300 whitespace-pre-wrap font-sans mt-1 bg-slate-900/60 p-3 rounded-lg border border-slate-800' }, result.script)
                  ),
                  React.createElement('div', null,
                    React.createElement('span', { className: 'text-[10px] uppercase font-bold text-slate-400' }, 'Rekomendasi Tag:'),
                    React.createElement('p', { className: 'text-xs text-sky-400 font-mono mt-0.5' }, result.hashtags)
                  )
                ),

                statusMessage && React.createElement('p', {
                  className: `text-xs text-center font-semibold ${statusMessage.includes('✓') ? 'text-emerald-400' : 'text-slate-400'}`
                }, statusMessage)
              ),

              React.createElement('div', { className: 'px-6 py-3 border-t border-slate-800 flex justify-between items-center bg-slate-950/40' },
                React.createElement('span', { className: 'text-[11px] text-slate-500' }, 'Status: Aman (Zero-Credential Leak)'),
                React.createElement('div', { className: 'flex space-x-2' },
                  React.createElement('button', {
                    onClick: () => setIsOpen(false),
                    className: 'px-3 py-1.5 text-xs text-slate-400 hover:text-white'
                  }, 'Tutup'),
                  result && React.createElement('button', {
                    disabled: isSubmitting,
                    onClick: handleSendToPlanner,
                    className: 'px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors'
                  }, isSubmitting ? 'Menyimpan...' : 'Kirim ke Bank Ide Planner')
                )
              )
            )
          )
        );
      };

      window.ReactDOM.render(React.createElement(StudioDrawer), containerElement);
    };

    return { renderStudioModal };
  };

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('content-ai-studio-ui', ContentAIUIFactory, {
      name: 'Content AI Studio UI Component',
      version: '1.0.0',
      dependencies: ['content-ai', 'workspace-manager']
    });
  }
})(window);
