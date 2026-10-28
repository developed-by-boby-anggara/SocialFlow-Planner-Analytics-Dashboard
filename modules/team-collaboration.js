/**
 * SocialFlow V3 - Team Collaboration, RBAC & Client Portal Engine
 * File: modules/team-collaboration.js
 * Namespace: window.SocialFlow.Modules.TeamCollaboration
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  const PERMISSION_ROLES = {
    'Owner': { canEditContent: true, canApprove: true, canViewFinances: true, canManageTeam: true, isClient: false },
    'Admin': { canEditContent: true, canApprove: true, canViewFinances: true, canManageTeam: true, isClient: false },
    'Strategist': { canEditContent: true, canApprove: true, canViewFinances: true, canManageTeam: false, isClient: false },
    'Content Creator': { canEditContent: true, canApprove: false, canViewFinances: false, canManageTeam: false, isClient: false },
    'Editor': { canEditContent: true, canApprove: true, canViewFinances: false, canManageTeam: false, isClient: false },
    'Analyst': { canEditContent: false, canApprove: false, canViewFinances: true, canManageTeam: false, isClient: false },
    'Client Reviewer': { canEditContent: false, canApprove: true, canViewFinances: false, canManageTeam: false, isClient: true },
    'Viewer': { canEditContent: false, canApprove: false, canViewFinances: false, canManageTeam: false, isClient: false }
  };

  const TeamCollaborationFactory = (core) => {
    const { logger, events, context, data } = core;

    let members = [];
    let activityLogs = [];
    let currentUserRole = 'Owner';

    const loadLocalData = () => {
      try {
        const storedMembers = localStorage.getItem('sf_v3_team_members');
        const storedLogs = localStorage.getItem('sf_v3_activity_logs');
        const storedRole = localStorage.getItem('sf_v3_current_role');
        if (storedMembers) members = JSON.parse(storedMembers);
        if (storedLogs) activityLogs = JSON.parse(storedLogs);
        if (storedRole) currentUserRole = storedRole;
      } catch (e) {
        logger.warn('Gagal membaca cache kolaborasi tim.');
      }
    };

    loadLocalData();

    const persistData = () => {
      try {
        localStorage.setItem('sf_v3_team_members', JSON.stringify(members));
        localStorage.setItem('sf_v3_activity_logs', JSON.stringify(activityLogs));
        localStorage.setItem('sf_v3_current_role', currentUserRole);
      } catch (e) {
        logger.warn('Gagal menyimpan cache kolaborasi tim.');
      }
    };

    const api = {
      getAvailableRoles: () => Object.keys(PERMISSION_ROLES),

      getCurrentRole: () => currentUserRole,

      setCurrentRole: (role) => {
        if (!PERMISSION_ROLES[role]) throw new Error(`Role tidak valid: ${role}`);
        currentUserRole = role;
        persistData();
        events.emit('role:switched', role);
        logger.info(`Sesi peran pengguna diubah ke: ${role}`);
        return currentUserRole;
      },

      hasPermission: (actionKey) => {
        const roleConfig = PERMISSION_ROLES[currentUserRole] || PERMISSION_ROLES['Viewer'];
        return !!roleConfig[actionKey];
      },

      isClientView: () => {
        const roleConfig = PERMISSION_ROLES[currentUserRole] || PERMISSION_ROLES['Viewer'];
        return roleConfig.isClient;
      },

      getTeamMembersByProject: (projectId) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        return members.filter(m => m.projectId === curProj && m.status !== 'removed');
      },

      inviteMember: ({ email, name, role, projectId }) => {
        if (!api.hasPermission('canManageTeam')) {
          throw new Error('Anda tidak memiliki otoritas untuk mengundang anggota tim.');
        }
        if (!email || !name) throw new Error('Email dan Nama wajib diisi.');

        const curProj = projectId || context.get().projectId || 'default-project';
        const newMember = {
          id: `mem-${Date.now()}`,
          projectId: curProj,
          workspaceId: context.get().workspaceId || 'default-workspace',
          email: email.trim().toLowerCase(),
          name: name.trim(),
          role: role || 'Viewer',
          status: 'invited',
          invitedAt: new Date().toISOString()
        };

        members.push(newMember);
        persistData();

        const db = data.getDb();
        if (db) {
          db.collection('project_members').doc(newMember.id).set(newMember, { merge: true }).catch(() => {});
        }

        api.logActivity('MEMBER_INVITED', `Mengundang ${newMember.email} sebagai ${newMember.role}`);
        events.emit('team:member-invited', newMember);
        return newMember;
      },

      logActivity: (actionType, details, targetId = null) => {
        const curProj = context.get().projectId || 'default-project';
        const logEntry = {
          id: `act-${Date.now()}`,
          projectId: curProj,
          actor: context.get().userEmail || 'Boby Anggara',
          actorRole: currentUserRole,
          actionType,
          details,
          targetId,
          timestamp: new Date().toISOString()
        };

        activityLogs.unshift(logEntry);
        if (activityLogs.length > 100) activityLogs.pop();
        persistData();

        const db = data.getDb();
        if (db) {
          db.collection('activity_logs').doc(logEntry.id).set(logEntry).catch(() => {});
        }

        events.emit('activity:logged', logEntry);
        return logEntry;
      },

      getActivityLogsByProject: (projectId) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        return activityLogs.filter(l => l.projectId === curProj);
      },

      submitClientApproval: async (contentId, decision, feedback = '') => {
        if (decision !== 'Approved' && decision !== 'Revision Required') {
          throw new Error('Keputusan client approval tidak valid.');
        }

        const workflow = core.Registry ? core.Registry.get('production-workflow') : null;
        if (workflow) {
          await workflow.transitionStatus(
            contentId,
            decision,
            `Client (${currentUserRole})`,
            feedback || (decision === 'Approved' ? 'Disetujui oleh Klien' : 'Revisi diminta oleh Klien')
          );
        }

        api.logActivity(
          decision === 'Approved' ? 'CLIENT_APPROVED' : 'CLIENT_REVISION_REQUESTED',
          `Klien memberikan evaluasi: ${decision}. Catatan: ${feedback}`,
          contentId
        );

        return { success: true, decision, feedback };
      }
    };

    return api;
  };

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('team-collaboration', TeamCollaborationFactory, {
      name: 'Team Collaboration & RBAC Engine',
      version: '1.0.0',
      dependencies: ['workspace-manager', 'production-workflow']
    });
  }
})(window);
