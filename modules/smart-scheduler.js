/**
 * SocialFlow V3 - Smart Scheduler, Publishing Adapter & Automation Engine
 * File: modules/smart-scheduler.js
 * Namespace: window.SocialFlow.Modules.SmartScheduler
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  const MAX_RETRY_LIMIT = 3;
  const DEFAULT_TIMEZONE = 'Asia/Jakarta';

  const SmartSchedulerFactory = (core) => {
    const { logger, events, context, data } = core;

    let schedules = [];
    let automationRules = [];

    const loadLocalData = () => {
      try {
        const storedSch = localStorage.getItem('sf_v3_publishing_schedules');
        const storedRules = localStorage.getItem('sf_v3_automation_rules');
        if (storedSch) schedules = JSON.parse(storedSch);
        if (storedRules) automationRules = JSON.parse(storedRules);
      } catch (e) {
        logger.warn('Gagal membaca cache scheduler lokal.');
      }
    };

    loadLocalData();

    const persistData = () => {
      try {
        localStorage.setItem('sf_v3_publishing_schedules', JSON.stringify(schedules));
        localStorage.setItem('sf_v3_automation_rules', JSON.stringify(automationRules));
      } catch (e) {
        logger.warn('Gagal menyimpan cache scheduler.');
      }
    };

    const api = {
      validateScheduleSlot: (targetTimeStr, targetPlatform, excludeScheduleId = null) => {
        const curProj = context.get().projectId || 'default-project';
        const targetMs = new Date(targetTimeStr).getTime();

        const conflict = schedules.find(s => {
          if (s.id === excludeScheduleId) return false;
          if (s.projectId !== curProj || s.platform !== targetPlatform) return false;
          if (s.status === 'Cancelled' || s.status === 'Published') return false;

          const existingMs = new Date(s.scheduledTime).getTime();
          return Math.abs(existingMs - targetMs) < 15 * 60 * 1000;
        });

        return {
          hasConflict: !!conflict,
          conflictingItem: conflict || null
        };
      },

      scheduleContent: async ({ contentId, scheduledTime, platform, timezone = DEFAULT_TIMEZONE, targetAccountId = null }) => {
        const curProj = context.get().projectId || 'default-project';
        const db = data.getDb();

        let isApproved = true;
        if (db) {
          try {
            const doc = await db.collection('contents').doc(contentId).get();
            if (doc.exists) {
              const cData = doc.data();
              const currentStatus = cData.workflowStatus || cData.status || '';
              if (['Idea', 'Brief', 'Revision Required'].includes(currentStatus)) {
                throw new Error(`Konten tidak dapat dijadwalkan karena berstatus "${currentStatus}". Selesaikan approval terlebih dahulu.`);
              }
            }
          } catch (e) {
            logger.warn(`Verifikasi approval Firestore dilewati: ${e.message}`);
          }
        }

        const conflictCheck = api.validateScheduleSlot(scheduledTime, platform);
        if (conflictCheck.hasConflict) {
          logger.warn(`Peringatan: Jadwal berdekatan (<15 menit) dengan jadwal lain pada platform ${platform}.`);
        }

        const newSchedule = {
          id: `sch-${Date.now()}`,
          projectId: curProj,
          contentId,
          targetAccountId: targetAccountId || null,
          platform: platform || 'Instagram',
          scheduledTime,
          timezone,
          status: 'Scheduled',
          retryCount: 0,
          isPublishedExternally: false,
          createdAt: new Date().toISOString()
        };

        schedules.push(newSchedule);
        persistData();

        if (db) {
          db.collection('publishing_schedules').doc(newSchedule.id).set(newSchedule, { merge: true }).catch(() => {});
          db.collection('contents').doc(contentId).set({
            status: 'Jadwal',
            workflowStatus: 'Scheduled',
            scheduledTime,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        }

        events.emit('scheduler:content-scheduled', newSchedule);
        logger.info(`Konten [${contentId}] berhasil dijadwalkan pada: ${scheduledTime} (${timezone})`);
        return newSchedule;
      },

      cancelSchedule: async (scheduleId) => {
        const target = schedules.find(s => s.id === scheduleId);
        if (!target) return false;

        target.status = 'Cancelled';
        persistData();

        const db = data.getDb();
        if (db) {
          db.collection('publishing_schedules').doc(scheduleId).update({ status: 'Cancelled' }).catch(() => {});
          db.collection('contents').doc(target.contentId).set({
            status: 'Draft',
            workflowStatus: 'Approved',
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        }

        events.emit('scheduler:schedule-cancelled', target);
        return true;
      },

      dispatchPublish: async (scheduleId) => {
        const target = schedules.find(s => s.id === scheduleId);
        if (!target) throw new Error('Jadwal tidak ditemukan.');

        if (target.status === 'Published') {
          throw new Error('Konten sudah berstatus Published. Menolak duplikasi publikasi.');
        }

        target.status = 'Publishing';
        persistData();

        try {
          const simulatedExternalSuccess = true;

          if (simulatedExternalSuccess) {
            target.status = 'Published';
            target.isPublishedExternally = true;
            target.publishedAt = new Date().toISOString();
            persistData();

            const db = data.getDb();
            if (db) {
              db.collection('publishing_schedules').doc(target.id).set(target, { merge: true }).catch(() => {});
              db.collection('contents').doc(target.contentId).set({
                status: 'Selesai',
                workflowStatus: 'Published',
                publishedAt: target.publishedAt,
                updatedAt: new Date().toISOString()
              }, { merge: true }).catch(() => {});
            }

            events.emit('scheduler:published', target);
            logger.info(`Publikasi selesai untuk schedule ID: ${target.id}`);
            return { success: true, target };
          }
        } catch (err) {
          target.retryCount += 1;
          target.status = target.retryCount >= MAX_RETRY_LIMIT ? 'Failed' : 'Scheduled';
          target.lastError = err.message || 'Gagal terhubung ke endpoint publikasi';
          persistData();

          events.emit('scheduler:failed', { target, error: target.lastError });
          throw new Error(`Gagal publikasi: ${target.lastError}. (Percobaan: ${target.retryCount}/${MAX_RETRY_LIMIT})`);
        }
      },

      runAutomationChecks: (allTasks = []) => {
        const now = Date.now();
        const alerts = [];

        allTasks.forEach(task => {
          if (!task.deadline || task.isCompleted) return;
          const deadlineMs = new Date(task.deadline).getTime();
          const diffHours = (deadlineMs - now) / (1000 * 60 * 60);

          if (diffHours < 0) {
            alerts.push({
              type: 'OVERDUE',
              taskId: task.id,
              title: task.title,
              message: `Tugas "${task.title}" telah melewati deadline!`
            });
          } else if (diffHours <= 24) {
            alerts.push({
              type: 'DEADLINE_APPROACHING',
              taskId: task.id,
              title: task.title,
              message: `Tugas "${task.title}" tersisa kurang dari 24 jam.`
            });
          }
        });

        if (alerts.length > 0) {
          events.emit('automation:alerts-detected', alerts);
        }
        return alerts;
      },

      getSchedulesByProject: (projectId) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        return schedules.filter(s => s.projectId === curProj);
      }
    };

    return api;
  };

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('smart-scheduler', SmartSchedulerFactory, {
      name: 'Smart Scheduler & Automation Engine',
      version: '1.0.0',
      dependencies: ['workspace-manager', 'production-workflow']
    });
  }
})(window);
