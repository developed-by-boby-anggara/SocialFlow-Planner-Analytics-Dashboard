/**
 * SocialFlow V3 - Campaign Management & Asset Library
 * File: modules/campaign-asset-manager.js
 * Namespace: window.SocialFlow.Modules.CampaignAssetManager
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // Limit 15MB
  const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime',
    'application/pdf'
  ];

  const CampaignAssetFactory = (core) => {
    const { logger, events, context, data } = core;

    let campaigns = [];
    let assets = [];

    const loadLocalData = () => {
      try {
        const storedCmp = localStorage.getItem('sf_v3_campaigns');
        const storedAst = localStorage.getItem('sf_v3_assets');
        if (storedCmp) campaigns = JSON.parse(storedCmp);
        if (storedAst) assets = JSON.parse(storedAst);
      } catch (e) {
        logger.warn('Gagal membaca cache kampanye & aset lokal.');
      }
    };

    loadLocalData();

    const persistData = () => {
      try {
        localStorage.setItem('sf_v3_campaigns', JSON.stringify(campaigns));
        localStorage.setItem('sf_v3_assets', JSON.stringify(assets));
      } catch (e) {
        logger.warn('Gagal menyimpan cache kampanye & aset.');
      }
    };

    const api = {
      // --- CAMPAIGN OPERATIONS ---
      getCampaignsByProject: (projectId, statusFilter = 'ALL') => {
        const curProj = projectId || context.get().projectId || 'default-project';
        return campaigns.filter(c => {
          const matchProj = c.projectId === curProj;
          const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
          return matchProj && matchStatus;
        });
      },

      createCampaign: ({ name, objective, startDate, endDate, budget = 0, briefNotes = '' }) => {
        if (!name || !name.trim()) throw new Error('Nama kampanye wajib diisi.');
        const curProj = context.get().projectId || 'default-project';

        const newCampaign = {
          id: `cmp-${Date.now()}`,
          projectId: curProj,
          workspaceId: context.get().workspaceId || 'default-workspace',
          name: name.trim(),
          objective: objective || 'Brand Awareness',
          startDate: startDate || new Date().toISOString().split('T')[0],
          endDate: endDate || '',
          budget: Number(budget) || 0,
          briefNotes: briefNotes.trim(),
          status: 'Active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        campaigns.push(newCampaign);
        persistData();

        const db = data.getDb();
        if (db) {
          db.collection('campaigns').doc(newCampaign.id).set(newCampaign, { merge: true }).catch(() => {});
        }

        events.emit('campaign:created', newCampaign);
        logger.info(`Kampanye baru dibuat: ${newCampaign.name} (${curProj})`);
        return newCampaign;
      },

      updateCampaignStatus: (campaignId, targetStatus) => {
        const idx = campaigns.findIndex(c => c.id === campaignId);
        if (idx === -1) return false;

        campaigns[idx].status = targetStatus;
        campaigns[idx].updatedAt = new Date().toISOString();
        persistData();

        const db = data.getDb();
        if (db) {
          db.collection('campaigns').doc(campaignId).update({
            status: targetStatus,
            updatedAt: campaigns[idx].updatedAt
          }).catch(() => {});
        }

        events.emit('campaign:updated', campaigns[idx]);
        return true;
      },

      // --- ASSET LIBRARY OPERATIONS ---
      getAssetsByProject: (projectId, { category = 'ALL', search = '' } = {}) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        return assets.filter(a => {
          if (a.projectId !== curProj || a.status === 'archived') return false;
          if (category !== 'ALL' && a.fileType !== category) return false;
          if (search) {
            const query = search.toLowerCase();
            const matchName = a.name.toLowerCase().includes(query);
            const matchTag = a.tags && a.tags.some(t => t.toLowerCase().includes(query));
            return matchName || matchTag;
          }
          return true;
        });
      },

      registerAsset: ({ name, fileUrl, mimeType, sizeBytes = 0, tags = [], campaignId = null }) => {
        if (!name || !fileUrl) throw new Error('Nama dan URL file wajib disertakan.');

        // Validasi Anti-Base64 & Batas Ukuran
        if (fileUrl.startsWith('data:') && sizeBytes > 1024 * 500) {
          throw new Error('File base64 berukuran besar dilarang disimpan langsung.');
        }

        if (sizeBytes > MAX_FILE_SIZE_BYTES) {
          throw new Error(`Ukuran file melebihi batas maksimal ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`);
        }

        let fileType = 'document';
        if (mimeType.startsWith('image/')) fileType = 'image';
        else if (mimeType.startsWith('video/')) fileType = 'video';

        const curProj = context.get().projectId || 'default-project';
        const newAsset = {
          id: `ast-${Date.now()}`,
          projectId: curProj,
          campaignId: campaignId || null,
          name: name.trim(),
          fileUrl,
          mimeType,
          fileType,
          sizeBytes,
          tags: Array.isArray(tags) ? tags : [],
          usedInContentIds: [],
          status: 'active',
          createdAt: new Date().toISOString()
        };

        assets.push(newAsset);
        persistData();

        const db = data.getDb();
        if (db) {
          db.collection('assets').doc(newAsset.id).set(newAsset, { merge: true }).catch(() => {});
        }

        events.emit('asset:registered', newAsset);
        logger.info(`Aset terdaftar: ${newAsset.name}`);
        return newAsset;
      },

      deleteAsset: (assetId) => {
        const target = assets.find(a => a.id === assetId);
        if (!target) return false;

        if (target.usedInContentIds && target.usedInContentIds.length > 0) {
          throw new Error(`Aset tidak dapat dihapus karena masih direferensikan oleh ${target.usedInContentIds.length} konten.`);
        }

        target.status = 'archived';
        persistData();

        const db = data.getDb();
        if (db) {
          db.collection('assets').doc(assetId).update({ status: 'archived' }).catch(() => {});
        }

        events.emit('asset:archived', { id: assetId });
        return true;
      },

      linkAssetToContent: (assetId, contentId) => {
        const target = assets.find(a => a.id === assetId);
        if (!target) return false;

        if (!target.usedInContentIds.includes(contentId)) {
          target.usedInContentIds.push(contentId);
          persistData();
          events.emit('asset:linked', { assetId, contentId });
        }
        return true;
      }
    };

    return api;
  };

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('campaign-asset-manager', CampaignAssetFactory, {
      name: 'Campaign & Asset Manager',
      version: '1.0.0',
      dependencies: ['workspace-manager']
    });
  }
})(window);
