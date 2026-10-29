/**
 * SocialFlow V3 - Firebase Security Rules Unit Test Suite
 * File: test/security-rules.test.js
 * Framework: Mocha + @firebase/rules-unit-testing
 */

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'socialflow-security-test';
let testEnv;

describe('SocialFlow V3 Security Rules Comprehensive Suite', function () {
  this.timeout(15000);

  before(async () => {
    // Membaca aturan firestore.rules dari root directory
    const rulesPath = path.resolve(__dirname, '../firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: rulesContent,
        host: '127.0.0.1',
        port: 8080
      }
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Setup Data Awal menggunakan bypass Security Rules
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // 1. Setup Workspace (Owner: user-alice)
      await db.collection('workspaces').doc('ws-alpha').set({
        name: 'Workspace Alpha',
        ownerUid: 'user-alice',
        createdAt: new Date().toISOString()
      });

      // 2. Setup Membership & Roles untuk Proyek A (project-alpha)
      // ID Document Format: projectId + '_' + uid
      await db.collection('project_members').doc('project-alpha_user-alice').set({
        projectId: 'project-alpha',
        uid: 'user-alice',
        role: 'Owner'
      });

      await db.collection('project_members').doc('project-alpha_user-bob').set({
        projectId: 'project-alpha',
        uid: 'user-bob',
        role: 'Content Creator'
      });

      await db.collection('project_members').doc('project-alpha_user-charlie').set({
        projectId: 'project-alpha',
        uid: 'user-charlie',
        role: 'Client Reviewer'
      });

      // 3. Setup Membership untuk Proyek B (project-beta)
      await db.collection('project_members').doc('project-beta_user-david').set({
        projectId: 'project-beta',
        uid: 'user-david',
        role: 'Owner'
      });

      // 4. Setup Konten Awal di project-alpha
      await db.collection('contents').doc('content-draft').set({
        projectId: 'project-alpha',
        title: 'Draft Postingan',
        workflowStatus: 'Idea',
        clientFeedback: '',
        updatedAt: new Date().toISOString()
      });

      await db.collection('contents').doc('content-published').set({
        projectId: 'project-alpha',
        title: 'Postingan Terbit',
        workflowStatus: 'Published',
        clientFeedback: '',
        updatedAt: new Date().toISOString()
      });

      // 5. Setup Catatan Finansial di project-alpha
      await db.collection('cost_records').doc('cost-001').set({
        projectId: 'project-alpha',
        amount: 2500000,
        category: 'ads',
        createdAt: new Date().toISOString()
      });

      await db.collection('client_invoices').doc('inv-001').set({
        projectId: 'project-alpha',
        amount: 7500000,
        status: 'paid',
        createdAt: new Date().toISOString()
      });

      // 6. Setup Audit Log & Automation Rule Awal
      await db.collection('activity_logs').doc('log-001').set({
        projectId: 'project-alpha',
        action: 'PROJECT_INITIALIZED',
        timestamp: new Date().toISOString()
      });

      await db.collection('automation_rules').doc('rule-001').set({
        projectId: 'project-alpha',
        name: 'Auto Archive Rule',
        trigger: 'SCHEDULED'
      });
    });
  });

  // =========================================================================
  // 1. WORKSPACE ISOLATION TESTS
  // =========================================================================
  describe('1. Workspace Isolation', () => {
    it('Mengizinkan pemilik workspace membaca dokumen miliknya', async () => {
      const aliceDb = testEnv.authenticatedContext('user-alice').firestore();
      await assertSucceeds(aliceDb.collection('workspaces').doc('ws-alpha').get());
    });

    it('Menolak pengguna lain membaca workspace yang bukan miliknya', async () => {
      const bobDb = testEnv.authenticatedContext('user-bob').firestore();
      await assertFails(bobDb.collection('workspaces').doc('ws-alpha').get());
    });

    it('Menolak pengguna lain memperbarui atau menghapus workspace milik orang lain', async () => {
      const bobDb = testEnv.authenticatedContext('user-bob').firestore();
      await assertFails(bobDb.collection('workspaces').doc('ws-alpha').update({ name: 'Hacked Workspace' }));
      await assertFails(bobDb.collection('workspaces').doc('ws-alpha').delete());
    });
  });

  // =========================================================================
  // 2. ANTI-PRIVILEGE ESCALATION TESTS (PROJECT_MEMBERS)
  // =========================================================================
  describe('2. Anti-Privilege Escalation & Format ID project_members', () => {
    it('Menolak pengguna biasa menambahkan dirinya sendiri menjadi Owner di proyek', async () => {
      const bobDb = testEnv.authenticatedContext('user-bob').firestore();
      await assertFails(
        bobDb.collection('project_members').doc('project-alpha_user-eve').set({
          projectId: 'project-alpha',
          uid: 'user-eve',
          role: 'Owner'
        })
      );
    });

    it('Menolak pembuatan project_members jika format ID tidak valid (memberId != projectId + "_" + uid)', async () => {
      const aliceDb = testEnv.authenticatedContext('user-alice').firestore();
      await assertFails(
        aliceDb.collection('project_members').doc('invalid-custom-id').set({
          projectId: 'project-alpha',
          uid: 'user-eve',
          role: 'Editor'
        })
      );
    });

    it('Mengizinkan Owner menambah member baru dengan format ID yang valid', async () => {
      const aliceDb = testEnv.authenticatedContext('user-alice').firestore();
      await assertSucceeds(
        aliceDb.collection('project_members').doc('project-alpha_user-eve').set({
          projectId: 'project-alpha',
          uid: 'user-eve',
          role: 'Editor'
        })
      );
    });

    it('Menolak perubahan projectId atau uid saat member diperbarui', async () => {
      const aliceDb = testEnv.authenticatedContext('user-alice').firestore();
      await assertFails(
        aliceDb.collection('project_members').doc('project-alpha_user-bob').update({
          projectId: 'project-beta'
        })
      );
    });
  });

  // =========================================================================
  // 3. PROJECT ISOLATION TESTS (CONTENTS)
  // =========================================================================
  describe('3. Project Isolation pada Dokumen Contents', () => {
    it('Menolak anggota Proyek B membaca konten milik Proyek A', async () => {
      const davidDb = testEnv.authenticatedContext('user-david').firestore();
      await assertFails(davidDb.collection('contents').doc('content-draft').get());
    });

    it('Menolak pengguna memindahkan konten Proyek A ke Proyek B saat update', async () => {
      const aliceDb = testEnv.authenticatedContext('user-alice').firestore();
      await assertFails(
        aliceDb.collection('contents').doc('content-draft').update({
          projectId: 'project-beta'
        })
      );
    });
  });

  // =========================================================================
  // 4. FIELD-LEVEL RBAC (CONTENTS)
  // =========================================================================
  describe('4. Field-Level RBAC pada Dokumen Contents', () => {
    it('Mengizinkan Content Creator memperbarui konten pada status Idea', async () => {
      const bobDb = testEnv.authenticatedContext('user-bob').firestore();
      await assertSucceeds(
        bobDb.collection('contents').doc('content-draft').update({
          title: 'Judul Revisi Creator'
        })
      );
    });

    it('Menolak Content Creator memperbarui konten yang statusnya Published', async () => {
      const bobDb = testEnv.authenticatedContext('user-bob').firestore();
      await assertFails(
        bobDb.collection('contents').doc('content-published').update({
          title: 'Mencoba Mengubah Konten Tayang'
        })
      );
    });

    it('Mengizinkan Client Reviewer hanya memodifikasi keys workflowStatus, clientFeedback, dan updatedAt', async () => {
      const charlieDb = testEnv.authenticatedContext('user-charlie').firestore();
      await assertSucceeds(
        charlieDb.collection('contents').doc('content-draft').update({
          workflowStatus: 'Revision Required',
          clientFeedback: 'Tolong perbaiki hook intro.',
          updatedAt: new Date().toISOString()
        })
      );
    });

    it('Menolak Client Reviewer mengubah key terlarang (misal: title)', async () => {
      const charlieDb = testEnv.authenticatedContext('user-charlie').firestore();
      await assertFails(
        charlieDb.collection('contents').doc('content-draft').update({
          title: 'Judul Diubah Klien',
          workflowStatus: 'Approved'
        })
      );
    });
  });

  // =========================================================================
  // 5. FINANCIAL RBAC TESTS
  // =========================================================================
  describe('5. Financial RBAC (cost_records & client_invoices)', () => {
    it('Menolak Client Reviewer membaca atau memodifikasi data cost_records', async () => {
      const charlieDb = testEnv.authenticatedContext('user-charlie').firestore();
      await assertFails(charlieDb.collection('cost_records').doc('cost-001').get());
      await assertFails(
        charlieDb.collection('cost_records').doc('cost-new').set({
          projectId: 'project-alpha',
          amount: 500000
        })
      );
    });

    it('Menolak Client Reviewer membaca dokumen client_invoices', async () => {
      const charlieDb = testEnv.authenticatedContext('user-charlie').firestore();
      await assertFails(charlieDb.collection('client_invoices').doc('inv-001').get());
    });

    it('Mengizinkan Owner membaca dan menulis data finansial', async () => {
      const aliceDb = testEnv.authenticatedContext('user-alice').firestore();
      await assertSucceeds(aliceDb.collection('cost_records').doc('cost-001').get());
      await assertSucceeds(aliceDb.collection('client_invoices').doc('inv-001').get());
    });
  });

  // =========================================================================
  // 6. AUDIT TRAIL IMMUTABILITY TESTS
  // =========================================================================
  describe('6. Audit Trail Immutability (activity_logs)', () => {
    it('Mengizinkan anggota proyek mencatat aktivitas baru (create)', async () => {
      const bobDb = testEnv.authenticatedContext('user-bob').firestore();
      await assertSucceeds(
        bobDb.collection('activity_logs').doc('log-002').set({
          projectId: 'project-alpha',
          action: 'DRAFT_CREATED',
          timestamp: new Date().toISOString()
        })
      );
    });

    it('Menolak penghapusan activity_logs sekalipun dilakukan oleh Owner (Append-Only)', async () => {
      const aliceDb = testEnv.authenticatedContext('user-alice').firestore();
      await assertFails(aliceDb.collection('activity_logs').doc('log-001').delete());
    });

    it('Menolak pembaruan (update) activity_logs oleh siapa pun', async () => {
      const aliceDb = testEnv.authenticatedContext('user-alice').firestore();
      await assertFails(
        aliceDb.collection('activity_logs').doc('log-001').update({
          action: 'TAMPERED_ACTION'
        })
      );
    });
  });

  // =========================================================================
  // 7. AUTOMATION RULES LOGIC TESTS
  // =========================================================================
  describe('7. Automation Rules (Pemisahan Create dan Update)', () => {
    it('Mengizinkan Admin/Owner membuat automation rule baru dengan projectId valid', async () => {
      const aliceDb = testEnv.authenticatedContext('user-alice').firestore();
      await assertSucceeds(
        aliceDb.collection('automation_rules').doc('rule-002').set({
          projectId: 'project-alpha',
          name: 'Publish Trigger',
          trigger: 'NOW'
        })
      );
    });

    it('Menolak non-admin membuat automation rule', async () => {
      const bobDb = testEnv.authenticatedContext('user-bob').firestore();
      await assertFails(
        bobDb.collection('automation_rules').doc('rule-003').set({
          projectId: 'project-alpha',
          name: 'Unauthorized Rule'
        })
      );
    });

    it('Mengizinkan Admin memperbarui automation rule selama projectId tidak diubah', async () => {
      const aliceDb = testEnv.authenticatedContext('user-alice').firestore();
      await assertSucceeds(
        aliceDb.collection('automation_rules').doc('rule-001').update({
          name: 'Updated Name',
          projectId: 'project-alpha'
        })
      );
    });

    it('Menolak pembaruan automation rule jika projectId dimutasi ke project lain', async () => {
      const aliceDb = testEnv.authenticatedContext('user-alice').firestore();
      await assertFails(
        aliceDb.collection('automation_rules').doc('rule-001').update({
          projectId: 'project-beta'
        })
      );
    });
  });
});
