/**
 * SocialFlow V3 - Multi Social Account Manager
 * File: modules/social-account-manager.js
 * Namespace: window.SocialFlow.Modules.SocialAccountManager
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  // Platform Capability Registry
  const PLATFORM_REGISTRY = {
    'Instagram': {
      label: 'Instagram',
      color: '#E1306C',
      capabilities: { canPublish: false, canReadInsights: false, canUploadMedia: false },
      apiSupported: false
    },
    'TikTok': {
      label: 'TikTok',
      color: '#000000',
      capabilities: { canPublish: false, canReadInsights: false, canUploadMedia: false },
      apiSupported: false
    },
    'YouTube': {
      label: 'YouTube',
      color: '#FF0000',
      capabilities: { canPublish: false, canReadInsights: false, canUploadMedia: false },
      apiSupported: false
    },
    'Facebook': {
      label: 'Facebook',
      color: '#1877F2',
      capabilities: { canPublish: false, canReadInsights: false, canUploadMedia: false },
      apiSupported: false
    },
    'LinkedIn': {
      label: 'LinkedIn',
      color: '#0A66C2',
      capabilities: { canPublish: false, canReadInsights: false, canUploadMedia: false },
      apiSupported: false
    },
    'X': {
      label: 'X (Twitter)',
      color: '#0f1419',
      capabilities: { canPublish: false, canReadInsights: false, canUploadMedia: false },
      apiSupported: false
    },
    'Pinterest': {
      label: 'Pinterest',
      color: '#BD081C',
      capabilities: { canPublish: false, canReadInsights: false, canUploadMedia: false },
      apiSupported: false
    }
  };

  const SocialAccountFactory = (core) => {
    const { logger, events, context, data } = core;
    let accounts = [];

    const loadAccounts = () => {
      try {
        const stored = localStorage.getItem('sf_v3_accounts');
        if (stored) accounts = JSON.parse(stored);
      } catch (e) {
        logger.warn('Gagal membaca cache akun lokal.');
      }
    };

    loadAccounts();

    const persistAccounts = () => {
      try {
        localStorage.setItem('sf_v3_accounts', JSON.stringify(accounts));
      } catch (e) {
        logger.warn('Gagal menyimpan cache akun.');
      }
    };

    const api = {
      getPlatformRegistry: () => PLATFORM_REGISTRY,

      // Operasi Baca Berbasis Project Terpilih
      getAccountsByProject: (projectId, platformFilter = 'ALL', includeArchived = false) => {
        const targetProjId = projectId || context.get().projectId || 'default-project';
        return accounts.filter(acc => {
          const matchProject = acc.projectId === targetProjId;
          const matchPlatform = platformFilter === 'ALL' || acc.platform === platformFilter;
          const matchStatus = includeArchived ? true : acc.status !== 'archived';
          return matchProject && matchPlatform && matchStatus;
        });
      },

      // Tambah Akun (Manual vs OAuth)
      addAccount: ({ platform, displayName, handle, connectionType = 'manual' }) => {
        if (!platform || !displayName || !handle) {
          throw new Error('Platform, Nama Akun, dan Handle wajib diisi.');
        }

        const ctx = context.get();
        const registryInfo = PLATFORM_REGISTRY[platform] || { capabilities: { canPublish: false, canReadInsights: false, canUploadMedia: false } };

        const verifiedConnectionType = registryInfo.apiSupported && connectionType === 'oauth_connected'
          ? 'oauth_connected'
          : 'manual';

        const newAccount = {
          id: `acc-${Date.now()}`,
          workspaceId: ctx.workspaceId || 'default-workspace',
          projectId: ctx.projectId || 'default-project',
          platform,
          displayName: displayName.trim(),
          handle: handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`,
          connectionType: verifiedConnectionType,
          status: 'active',
          capabilities: registryInfo.capabilities,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        accounts.push(newAccount);
        persistAccounts();

        const db = data.getDb();
        if (db) {
          db.collection('social_accounts').doc(newAccount.id).set(newAccount, { merge: true })
            .catch(err => logger.warn(`Gagal sinkron akun ke Firestore: ${err.message}`));
        }

        events.emit('account:created', newAccount);
        logger.info(`Akun sosial berhasil ditambahkan: ${newAccount.handle} (${platform})`);
        return newAccount;
      },

      // Perbarui Akun
      updateAccount: (accountId, patch) => {
        const idx = accounts.findIndex(a => a.id === accountId);
        if (idx === -1) return false;

        accounts[idx] = {
          ...accounts[idx],
          ...patch,
          updatedAt: new Date().toISOString()
        };
        persistAccounts();

        const db = data.getDb();
        if (db) {
          db.collection('social_accounts').doc(accountId).update(accounts[idx]).catch(() => {});
        }

        events.emit('account:updated', accounts[idx]);
        return true;
      },

      // Arsipkan Akun
      archiveAccount: (accountId) => {
        return api.updateAccount(accountId, { status: 'archived' });
      }
    };

    return api;
  };

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('social-account-manager', SocialAccountFactory, {
      name: 'Multi Social Account Manager',
      version: '1.0.0',
      dependencies: ['workspace-manager']
    });
  }
})(window);
