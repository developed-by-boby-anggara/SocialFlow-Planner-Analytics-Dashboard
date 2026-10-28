/**
 * SocialFlow V3 - Content Production Workflow & Approval Engine
 * File: modules/production-workflow.js
 * Namespace: window.SocialFlow.Modules.ProductionWorkflow
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  // Daftar Status Produksi Baku
  const WORKFLOW_STATES = [
    { key: 'Idea', label: 'Ide', color: '#64748b' },
    { key: 'Brief', label: 'Brief Siap', color: '#0284c7' },
    { key: 'Draft', label: 'Drafting', color: '#8b5cf6' },
    { key: 'In Production', label: 'Proses Syuting/Desain', color: '#f59e0b' },
    { key: 'Internal Review', label: 'Review Internal', color: '#ec4899' },
    { key: 'Client Review', label: 'Menunggu Approval Klien', color: '#f97316' },
    { key: 'Revision Required', label: 'Perlu Revisi', color: '#ef4444' },
    { key: 'Approved', label: 'Disetujui', color: '#10b981' },
    { key: 'Scheduled', label: 'Terjadwal', color: '#06b6d4' },
    { key: 'Published', label: 'Tayang', color: '#22c55e' },
    { key: 'Archived', label: 'Arsip', color: '#334155' }
  ];

  // Aturan Validasi Transisi Status (Mencegah Bypass Approval)
  const VALID_TRANSITIONS = {
    'Idea': ['Brief', 'Draft', 'Archived'],
    'Brief': ['Draft', 'Idea', 'Archived'],
    'Draft': ['In Production', 'Internal Review', 'Archived'],
    'In Production': ['Internal Review', 'Draft', 'Archived'],
    'Internal Review': ['Client Review', 'Revision Required', 'Approved', 'Draft'],
    'Client Review': ['Approved', 'Revision Required'],
    'Revision Required': ['In Production', 'Draft', 'Internal Review'],
    'Approved': ['Scheduled', 'Published', 'Archived'],
    'Scheduled': ['Published', 'Approved', 'Archived'],
    'Published': ['Archived'],
    'Archived': ['Idea', 'Draft']
  };

  const WorkflowFactory = (core) => {
    const { logger, events, context, data } = core;

    // Cache in-memory
    let tasks = [];
    let auditLogs = [];

    const loadLocalWorkflow = () => {
      try {
        const storedTasks = localStorage.getItem('sf_v3_production_tasks');
        const storedLogs = localStorage.getItem('sf_v3_production_logs');
        if (storedTasks) tasks = JSON.parse(storedTasks);
        if (storedLogs) auditLogs = JSON.parse(storedLogs);
      } catch (e) {
        logger.warn('Gagal membaca cache workflow lokal.');
      }
    };

    loadLocalWorkflow();

    const persistWorkflow = () => {
      try {
        localStorage.setItem('sf_v3_production_tasks', JSON.stringify(tasks));
        localStorage.setItem('sf_v3_production_logs', JSON.stringify(auditLogs));
      } catch (e) {
        logger.warn('Gagal menyimpan cache workflow.');
      }
    };

    const api = {
      getStates: () => WORKFLOW_STATES,

      // Validasi Transisi Status
      canTransition: (currentStatus, targetStatus) => {
        const allowed = VALID_TRANSITIONS[currentStatus];
        if (!allowed) return true; // Fallback jika status legacy
        return allowed.includes(targetStatus);
      },

      // Transisi Status Konten dengan Audit Log & Proteksi
      transitionStatus: async (contentId, targetStatus, actorName = 'System User', note = '') => {
        const db = data.getDb();
        const curProj = context.get().projectId || 'default-project';

        // Ambil data konten
        let currentItem = null;
        if (db) {
          try {
            const doc = await db.collection('contents').doc(contentId).get();
            if (doc.exists) currentItem = doc.data();
          } catch (e) {
            logger.warn(`Gagal membaca Firestore, fallback ke state internal: ${e.message}`);
          }
        }

        const prevStatus = currentItem ? (currentItem.workflowStatus || currentItem.status || 'Idea') : 'Idea';

        // Cegah perubahan tidak sah ke Published jika belum Approved
        if (targetStatus === 'Published' && prevStatus !== 'Approved' && prevStatus !== 'Scheduled') {
          throw new Error('Konten belum mendapatkan Approval yang sah sebelum dipublikasikan.');
        }

        // Catat Log Riwayat / Revision Tracker
        const logEntry = {
          id: `log-${Date.now()}`,
          contentId,
          projectId: curProj,
          action: 'STATUS_CHANGE',
          previousStatus: prevStatus,
          newStatus: targetStatus,
          note: note.trim(),
          actor: actorName,
          timestamp: new Date().toISOString()
        };

        auditLogs.unshift(logEntry);
        persistWorkflow();

        // Update di Firestore secara non-destruktif
        if (db) {
          const updatePayload = {
            workflowStatus: targetStatus,
            status: targetStatus === 'Published' ? 'Selesai' : (targetStatus === 'Scheduled' ? 'Jadwal' : 'Draft'),
            updatedAt: new Date().toISOString()
          };

          await db.collection('contents').doc(contentId).set(updatePayload, { merge: true });
          db.collection('production_history').doc(logEntry.id).set(logEntry).catch(() => {});
        }

        events.emit('workflow:status-changed', { contentId, prevStatus, targetStatus, logEntry });
        logger.info(`Status konten [${contentId}] berubah: ${prevStatus} -> ${targetStatus}`);
        return { success: true, logEntry };
      },

      // Catat Revisi Baru (Mencegah Timpa Versi Lama)
      recordRevision: async (contentId, { revisionNote, scriptSnapshot, actorName }) => {
        const curProj = context.get().projectId || 'default-project';
        const revisionEntry = {
          id: `rev-${Date.now()}`,
          contentId,
          projectId: curProj,
          action: 'REVISION_SUBMITTED',
          note: revisionNote,
          snapshot: scriptSnapshot || '',
          actor: actorName || 'Creator',
          timestamp: new Date().toISOString()
        };

        auditLogs.unshift(revisionEntry);
        persistWorkflow();

        const db = data.getDb();
        if (db) {
          db.collection('production_history').doc(revisionEntry.id).set(revisionEntry).catch(() => {});
        }

        events.emit('workflow:revision-added', revisionEntry);
        return revisionEntry;
      },

      // Ambil Riwayat & Log Aktivitas per Konten
      getContentHistory: (contentId) => {
        return auditLogs.filter(log => log.contentId === contentId);
      },

      // Checklist & Task Manager Terkait Konten
      createTask: ({ contentId, title, assignee = 'Unassigned', priority = 'Medium', deadline = null }) => {
        const curProj = context.get().projectId || 'default-project';
        const newTask = {
          id: `tsk-${Date.now()}`,
          contentId,
          projectId: curProj,
          title: title.trim(),
          assignee,
          priority,
          deadline,
          checklist: [],
          isCompleted: false,
          createdAt: new Date().toISOString()
        };

        tasks.push(newTask);
        persistWorkflow();
        events.emit('workflow:task-created', newTask);
        return newTask;
      },

      getTasksByProject: (projectId) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        return tasks.filter(t => t.projectId === curProj);
      },

      toggleChecklistItem: (taskId, itemIndex) => {
        const target = tasks.find(t => t.id === taskId);
        if (!target || !target.checklist[itemIndex]) return false;

        target.checklist[itemIndex].done = !target.checklist[itemIndex].done;
        persistWorkflow();
        events.emit('workflow:task-updated', target);
        return true;
      }
    };

    return api;
  };

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('production-workflow', WorkflowFactory, {
      name: 'Content Production Workflow',
      version: '1.0.0',
      dependencies: ['workspace-manager']
    });
  }
})(window);
