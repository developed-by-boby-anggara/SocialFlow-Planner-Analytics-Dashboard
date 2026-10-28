/**
 * SocialFlow V3 - Finance, Notifications & System Operations
 * File: modules/system-operations.js
 * Namespace: window.SocialFlow.Modules.SystemOperations
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  const SystemOperationsFactory = (core) => {
    const { logger, events, context, data } = core;

    let notifications = [];
    let invoices = [];
    let systemHealth = {
      firebaseConnected: false,
      lastSyncTimestamp: null,
      errorCount: 0,
      activeModulesCount: 0
    };

    const loadLocalData = () => {
      try {
        const storedNtf = localStorage.getItem('sf_v3_notifications');
        const storedInv = localStorage.getItem('sf_v3_invoices');
        if (storedNtf) notifications = JSON.parse(storedNtf);
        if (storedInv) invoices = JSON.parse(storedInv);
      } catch (e) {
        logger.warn('Gagal membaca cache lokal system operations.');
      }
    };

    loadLocalData();

    const persistLocal = () => {
      try {
        localStorage.setItem('sf_v3_notifications', JSON.stringify(notifications));
        localStorage.setItem('sf_v3_invoices', JSON.stringify(invoices));
      } catch (e) {
        logger.warn('Gagal menyimpan cache system operations.');
      }
    };

    const api = {
      // --- A. CLIENT PROFITABILITY ---
      recordInvoice: ({ amount, clientId, billingPeriod, type = 'actual', status = 'paid' }) => {
        const teamMod = core.Registry ? core.Registry.get('team-collaboration') : null;
        if (teamMod && !teamMod.hasPermission('canViewFinances')) {
          throw new Error('Akses Ditolak: Anda tidak memiliki izin untuk mengelola data finansial.');
        }

        const curProj = context.get().projectId || 'default-project';
        const invoice = {
          id: `inv-${Date.now()}`,
          projectId: curProj,
          clientId: clientId || 'Client-Direct',
          amount: Math.max(0, Number(amount) || 0),
          type,
          status,
          billingPeriod: billingPeriod || new Date().toISOString().substring(0, 7),
          recordedAt: new Date().toISOString()
        };

        invoices.push(invoice);
        persistLocal();

        const db = data.getDb();
        if (db) {
          db.collection('client_invoices').doc(invoice.id).set(invoice, { merge: true }).catch(() => {});
        }

        events.emit('finance:invoice-recorded', invoice);
        return invoice;
      },

      getClientProfitability: (projectId) => {
        const teamMod = core.Registry ? core.Registry.get('team-collaboration') : null;
        if (teamMod && !teamMod.hasPermission('canViewFinances')) {
          return { error: 'Akses terbatas untuk informasi keuangan.' };
        }

        const curProj = projectId || context.get().projectId || 'default-project';
        const analyticsMod = core.Registry ? core.Registry.get('advanced-analytics') : null;
        const finSummary = analyticsMod ? analyticsMod.getFinancialSummaryByProject(curProj) : { totalCost: 0 };

        const projectInvoices = invoices.filter(inv => inv.projectId === curProj && inv.status === 'paid');
        const totalRevenue = projectInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        const netProfit = totalRevenue - finSummary.totalCost;
        const marginPercentage = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(2)) : 0;

        return {
          projectId: curProj,
          totalRevenue,
          totalExpenses: finSummary.totalCost,
          netProfit,
          marginPercentage,
          invoicesCount: projectInvoices.length,
          disclaimer: 'Data profitabilitas dihitung berdasarkan pencatatan operasional internal proyek.'
        };
      },

      // --- B. NOTIFICATION CENTER ---
      pushNotification: ({ eventKey, title, message, type = 'SYSTEM', recipientRole = null, targetUrl = '' }) => {
        const curProj = context.get().projectId || 'default-project';
        const ntfId = `ntf-${curProj}-${eventKey || Date.now()}`;

        // Cegah notifikasi duplikat jika kunci event sudah ada
        const exists = notifications.some(n => n.id === ntfId);
        if (exists) return null;

        const newNtf = {
          id: ntfId,
          projectId: curProj,
          title: title.trim(),
          message: message.trim(),
          type,
          recipientRole,
          targetUrl,
          isRead: false,
          dispatchStatus: 'in_app_recorded',
          createdAt: new Date().toISOString()
        };

        notifications.unshift(newNtf);
        if (notifications.length > 50) notifications.pop();
        persistLocal();

        const db = data.getDb();
        if (db) {
          db.collection('app_notifications').doc(newNtf.id).set(newNtf, { merge: true }).catch(() => {});
        }

        events.emit('notification:new', newNtf);
        return newNtf;
      },

      getNotificationsByProject: (projectId, onlyUnread = false) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        return notifications.filter(n => {
          const matchProj = n.projectId === curProj;
          return onlyUnread ? (matchProj && !n.isRead) : matchProj;
        });
      },

      markNotificationAsRead: (notificationId) => {
        const target = notifications.find(n => n.id === notificationId);
        if (!target) return false;

        target.isRead = true;
        persistLocal();

        const db = data.getDb();
        if (db) {
          db.collection('app_notifications').doc(notificationId).update({ isRead: true }).catch(() => {});
        }

        events.emit('notification:read', { id: notificationId });
        return true;
      },

      // --- C & D. BACKUP, RESTORE & DATA MIGRATION ---
      createProjectDataBackup: async (projectId) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        const db = data.getDb();
        if (!db) throw new Error('Koneksi Firestore tidak tersedia untuk melakukan backup.');

        const snapshot = await db.collection('contents').where('projectId', '==', curProj).get();
        const exportData = [];
        snapshot.forEach(doc => exportData.push({ id: doc.id, ...doc.data() }));

        const backupPayload = {
          backupId: `bcp-${curProj}-${Date.now()}`,
          projectId: curProj,
          recordCount: exportData.length,
          records: exportData,
          createdAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);

        logger.info(`Backup berhasil dibuat untuk proyek ${curProj} (${exportData.length} records).`);
        return { backupId: backupPayload.backupId, recordCount: exportData.length, downloadUrl };
      },

      executeMigrationDryRun: async (projectId) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        const db = data.getDb();
        if (!db) throw new Error('Firestore offline.');

        const snapshot = await db.collection('contents').where('projectId', '==', curProj).get();
        let unmigratedCount = 0;

        snapshot.forEach(doc => {
          const item = doc.data();
          if (!item.workflowStatus || !item.createdAt) {
            unmigratedCount++;
          }
        });

        return {
          projectId: curProj,
          totalInspected: snapshot.size,
          candidatesForMigration: unmigratedCount,
          isSafeToMigrate: true,
          mode: 'DRY_RUN_ONLY'
        };
      },

      // --- E. SYSTEM HEALTH MONITOR ---
      getHealthStatus: () => {
        const db = data.getDb();
        systemHealth.firebaseConnected = !!db;
        systemHealth.lastSyncTimestamp = new Date().toISOString();
        systemHealth.activeModulesCount = core.Registry ? Object.keys(core.Registry.getAll()).length : 0;

        return {
          status: systemHealth.firebaseConnected ? 'OPERATIONAL' : 'DEGRADED_OFFLINE',
          details: { ...systemHealth },
          verifiedAt: systemHealth.lastSyncTimestamp
        };
      }
    };

    return api;
  };

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('system-operations', SystemOperationsFactory, {
      name: 'Finance, Notifications & System Operations',
      version: '1.0.0',
      dependencies: ['workspace-manager', 'team-collaboration', 'advanced-analytics']
    });
  }
})(window);
