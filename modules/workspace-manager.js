/**
 * SocialFlow V3 - Workspace, Project & Client Manager
 * File: modules/workspace-manager.js
 * Namespace: window.SocialFlow.Modules.WorkspaceManager
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  const DEFAULT_WORKSPACE = {
    id: 'default-workspace',
    name: 'Personal Workspace',
    role: 'owner',
    status: 'active'
  };

  const DEFAULT_PROJECT = {
    id: 'default-project',
    workspaceId: 'default-workspace',
    clientId: 'default-client',
    name: 'Personal Brand (Main)',
    description: 'Proyek utama dan data bawaan SocialFlow',
    color: '#0284c7',
    status: 'active',
    isDefault: true
  };

  const DEFAULT_CLIENT = {
    id: 'default-client',
    workspaceId: 'default-workspace',
    name: 'Internal / Self',
    company: 'Chocoovora Studio',
    status: 'active'
  };

  const WorkspaceManagerFactory = (core) => {
    const { logger, events, context, data } = core;

    // Cache state in-memory
    let workspaces = [DEFAULT_WORKSPACE];
    let projects = [DEFAULT_PROJECT];
    let clients = [DEFAULT_CLIENT];
    let activeProject = DEFAULT_PROJECT;

    // Load persisted state
    const loadFromStorage = () => {
      try {
        const storedProjects = localStorage.getItem('sf_v3_projects');
        const storedClients = localStorage.getItem('sf_v3_clients');
        const storedActiveProjectId = localStorage.getItem('sf_v3_active_project_id');

        if (storedProjects) {
          const parsed = JSON.parse(storedProjects);
          if (Array.isArray(parsed) && parsed.length > 0) {
            projects = parsed;
          }
        }
        if (storedClients) {
          const parsedClients = JSON.parse(storedClients);
          if (Array.isArray(parsedClients)) clients = parsedClients;
        }

        if (storedActiveProjectId) {
          const found = projects.find(p => p.id === storedActiveProjectId && p.status !== 'archived');
          if (found) activeProject = found;
        }
      } catch (err) {
        logger.warn('Gagal membaca cache projects/clients, menggunakan baseline default.');
      }
    };

    loadFromStorage();

    const persistProjects = () => {
      try {
        localStorage.setItem('sf_v3_projects', JSON.stringify(projects));
        localStorage.setItem('sf_v3_clients', JSON.stringify(clients));
        localStorage.setItem('sf_v3_active_project_id', activeProject.id);
      } catch (e) {
        logger.warn('Gagal menyimpan workspace state ke storage.');
      }
    };

    const api = {
      // --- PROJECT OPERATIONS ---
      getActiveProject: () => ({ ...activeProject }),

      getProjects: (includeArchived = false) => {
        return projects.filter(p => includeArchived ? true : p.status !== 'archived');
      },

      selectProject: (projectId) => {
        const target = projects.find(p => p.id === projectId);
        if (!target) {
          logger.error(`Project ID [${projectId}] tidak ditemukan.`);
          return false;
        }
        if (target.status === 'archived') {
          logger.warn(`Project [${target.name}] sedang diarsipkan. Batalkan arsip untuk mengakses.`);
          return false;
        }

        activeProject = target;
        context.set({
          projectId: target.id,
          projectName: target.name,
          workspaceId: target.workspaceId
        });

        persistProjects();
        logger.info(`Berpindah ke proyek: [${target.name}] (${target.id})`);
        events.emit('project:changed', { ...target });
        return true;
      },

      createProject: ({ name, description = '', color = '#0284c7', clientId = null }) => {
        if (!name || !name.trim()) {
          throw new Error('Nama proyek wajib diisi.');
        }

        const newProject = {
          id: `prj-${Date.now()}`,
          workspaceId: activeProject.workspaceId || DEFAULT_WORKSPACE.id,
          clientId: clientId || DEFAULT_CLIENT.id,
          name: name.trim(),
          description: description.trim(),
          color: color || '#0284c7',
          status: 'active',
          createdAt: new Date().toISOString()
        };

        projects.push(newProject);
        persistProjects();
        logger.info(`Project baru dibuat: ${newProject.name}`);
        events.emit('project:created', newProject);
        return newProject;
      },

      archiveProject: (projectId) => {
        if (projectId === DEFAULT_PROJECT.id) {
          throw new Error('Proyek utama (default) tidak dapat diarsipkan.');
        }
        const target = projects.find(p => p.id === projectId);
        if (!target) return false;

        target.status = 'archived';
        target.archivedAt = new Date().toISOString();

        // Jika proyek aktif yang diarsipkan, kembalikan ke default project
        if (activeProject.id === projectId) {
          api.selectProject(DEFAULT_PROJECT.id);
        } else {
          persistProjects();
        }

        logger.info(`Project diarsipkan: ${target.name}`);
        events.emit('project:archived', { id: projectId });
        return true;
      },

      // --- CLIENT OPERATIONS ---
      getClients: () => clients.filter(c => c.status !== 'archived'),

      createClient: ({ name, company = '', email = '', phone = '' }) => {
        if (!name || !name.trim()) throw new Error('Nama klien wajib diisi.');
        const newClient = {
          id: `clt-${Date.now()}`,
          workspaceId: activeProject.workspaceId || DEFAULT_WORKSPACE.id,
          name: name.trim(),
          company: company.trim(),
          email: email.trim(),
          phone: phone.trim(),
          status: 'active',
          createdAt: new Date().toISOString()
        };
        clients.push(newClient);
        persistProjects();
        events.emit('client:created', newClient);
        return newClient;
      },

      // --- DATA SCOPING HELPER ---
      // Memfilter isi koleksi contents berdasarkan project aktif
      filterContentsByActiveProject: (contents = []) => {
        const curProjId = activeProject.id;
        return contents.filter(item => {
          const itemProj = item.projectId || item.workspaceId;
          if (curProjId === DEFAULT_PROJECT.id) {
            // Project default memuat item dengan id default atau item legacy tanpa projectId
            return !itemProj || itemProj === 'default-project' || itemProj === 'default-workspace';
          }
          return itemProj === curProjId;
        });
      }
    };

    return api;
  };

  // Registrasi ke Core Registry
  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('workspace-manager', WorkspaceManagerFactory, {
      name: 'Workspace & Project Manager',
      version: '1.0.0',
      dependencies: []
    });
  }
})(window);
