/**
 * SocialFlow V3 - Scoped Social Account Manager Module
 * File: modules/social-account-manager.js
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  const SocialAccountManagerFactory = (core) => {
    return {
      init: function () {
        console.log('[SF-INFO][Registry] Modul [social-account-manager] scoped aktif.');

        // Sinkronkan akun saat pertama kali load dan saat project berganti
        const renderAccounts = () => this.syncUI();

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', renderAccounts);
        } else {
          setTimeout(renderAccounts, 400);
        }

        window.addEventListener('project:changed', () => {
          setTimeout(renderAccounts, 100);
        });
      },

      getActiveProjectId: function () {
        return localStorage.getItem('sf_active_project_id') || 'default-project';
      },

      getAccounts: function (projectId) {
        const pid = projectId || this.getActiveProjectId();
        const raw = localStorage.getItem(`sf_accounts_${pid}`);
        return raw ? JSON.parse(raw) : {
          instagram: '@chocoovora',
          tiktok: '@chocoovora.style',
          facebook: 'Chocoovora Official'
        };
      },

      setAccounts: function (accounts, projectId) {
        const pid = projectId || this.getActiveProjectId();
        localStorage.setItem(`sf_accounts_${pid}`, JSON.stringify(accounts));
        this.syncUI();
      },

      syncUI: function () {
        const pid = this.getActiveProjectId();
        const acc = this.getAccounts(pid);

        // Update badge username pada kartu ringkasan Instagram
        const igBadge = document.getElementById('sf-account-ig-badge');
        if (igBadge) igBadge.textContent = acc.instagram || 'Belum diatur';

        // Update badge username pada kartu ringkasan TikTok
        const ttBadge = document.getElementById('sf-account-tt-badge');
        if (ttBadge) ttBadge.textContent = acc.tiktok || 'Belum diatur';

        // Update badge username pada kartu ringkasan Facebook
        const fbBadge = document.getElementById('sf-account-fb-badge');
        if (fbBadge) fbBadge.textContent = acc.facebook || 'Belum diatur';
      },

      promptEditAccounts: function () {
        const pid = this.getActiveProjectId();
        const curr = this.getAccounts(pid);

        const newIg = prompt(`[${pid}] Masukkan Username Instagram:`, curr.instagram);
        if (newIg === null) return;

        const newTt = prompt(`[${pid}] Masukkan Username TikTok:`, curr.tiktok);
        if (newTt === null) return;

        const newFb = prompt(`[${pid}] Masukkan Nama/Page Facebook:`, curr.facebook);
        if (newFb === null) return;

        this.setAccounts({
          instagram: newIg.trim(),
          tiktok: newTt.trim(),
          facebook: newFb.trim()
        }, pid);
      }
    };
  };

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('social-account-manager', SocialAccountManagerFactory);
  }
})(window);
