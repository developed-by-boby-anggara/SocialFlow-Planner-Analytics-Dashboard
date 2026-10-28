/**
 * SocialFlow V3 - AI Content Studio & Brand Intelligence
 * File: modules/content-ai.js
 * Namespace: window.SocialFlow.Modules.ContentAI
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  const ENGINE_PATTERNS = {
    hooks: {
      awareness: [
        '90% orang masih belum sadar kalau [TOPIK] bisa bikin rugi banyak!',
        'Stop scroll! Ini fakta mencengangkan tentang [TOPIK] yang jarang dibahas.',
        'Kalau kamu lagi berjuang soal [TOPIK], tonton ini sebelum terlambat.'
      ],
      engagement: [
        'Jujur, kamu tim yang setuju atau nolak soal [TOPIK] ini? Tulis di komen!',
        'Cuma orang yang paham [TOPIK] yang tahu rasanya ada di posisi ini 😭',
        'Drop pendapat kamu: [TOPIK] itu sebenarnya ngebantu atau cuma hype?'
      ],
      conversion: [
        'Spill rahasia kenapa [TOPIK] ini selalu habis dalam hitungan jam!',
        'Solusi paling worth it buat kamu yang capek ngadepin [TOPIK]. Cek sekarang.',
        'Promo terbatas buat yang mau upgrade [TOPIK] tanpa keluar budget gede!'
      ],
      edukasi: [
        'Tutorial ringkas: Cara menguasai [TOPIK] hanya dalam 3 langkah simpel.',
        'Jangan keliru lagi! Bedah tuntas perbedaan mendasar pada [TOPIK].',
        '3 rumus anti-gagal yang wajib kamu catat seputar [TOPIK].'
      ]
    },
    scripts: {
      shortVideo: (hook, topic, cta, tone) => {
        return `[00:00 - 00:03] HOOK VISUAL & AUDIO:
"${hook}"
(Visual: Tunjukkan ekspresi kaget / close-up produk / gerakan cepat)

[00:03 - 00:15] MASALAH / RASA SAKIT AUDIENS:
Banyak yang ngira ${topic} itu rumit, padahal akar masalahnya cuma di kebiasaan kecil.

[00:15 - 00:45] SOLUSI & VALUE:
Langkah 1: Rapikan checklist dasar.
Langkah 2: Terapkan metode bertahap tanpa overthinking.
Langkah 3: Evaluasi hasilnya dalam 7 hari.

[00:45 - 00:60] CALL TO ACTION:
"${cta}"`;
      },
      carousel: (hook, topic, cta) => {
        return `Slide 1 (Cover): ${hook}
Slide 2 (Masalah): Kenapa sebagian besar orang gagal pas nerapin ${topic}?
Slide 3 (Kunci 1): Fondasi awal yang wajib dipersiapkan sebelum mulai.
Slide 4 (Kunci 2): Kesalahan fatal yang paling sering diulang dan cara hindarinya.
Slide 5 (Studi Kasus/Contoh): Gambaran nyata ketika berhasil dioptimalkan.
Slide 6 (Action Plan): Langkah konkrit yang bisa dicoba hari ini.
Slide 7 (Penutup & CTA): ${cta} (Simpan slide ini biar nggak lupa!)`;
      }
    }
  };

  const ContentAIFactory = (core) => {
    const { logger, events, context, data } = core;

    const getBrandProfileKey = (projId) => `sf_brand_profile_${projId}`;

    const defaultProfile = {
      tone: 'Casual & Energetic',
      targetAudience: 'Kreator konten & audiens muda usia 18-35 tahun',
      keywordsAllowed: ['praktis', 'terbukti', 'eksklusif', 'langsung coba'],
      forbiddenWords: ['murahan', 'hoax', 'mustahil'],
      defaultCta: 'Simpan postingan ini & bagikan ke teman kamu!'
    };

    const api = {
      getBrandProfile: (projectId) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        try {
          const cached = localStorage.getItem(getBrandProfileKey(curProj));
          if (cached) return JSON.parse(cached);
        } catch (_) {}
        return { ...defaultProfile, projectId: curProj };
      },

      saveBrandProfile: (projectId, profileData) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        const payload = { ...profileData, projectId: curProj, updatedAt: new Date().toISOString() };
        try {
          localStorage.setItem(getBrandProfileKey(curProj), JSON.stringify(payload));
        } catch (_) {}

        const db = data.getDb();
        if (db) {
          db.collection('brand_profiles').doc(`bvp-${curProj}`).set(payload, { merge: true }).catch(() => {});
        }
        logger.info(`Brand voice profile disimpan untuk project: ${curProj}`);
        events.emit('brand-profile:updated', payload);
        return payload;
      },

      generateStudioContent: ({ topic, platform, format, objective, projectId }) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        const profile = api.getBrandProfile(curProj);

        const obj = (objective || 'awareness').toLowerCase();
        const hooksPool = ENGINE_PATTERNS.hooks[obj] || ENGINE_PATTERNS.hooks.awareness;
        const selectedHook = hooksPool[Math.floor(Math.random() * hooksPool.length)].replace(/\[TOPIK\]/g, topic || 'ide ini');

        let script = '';
        if (format === 'Carousel') {
          script = ENGINE_PATTERNS.scripts.carousel(selectedHook, topic, profile.defaultCta);
        } else {
          script = ENGINE_PATTERNS.scripts.shortVideo(selectedHook, topic, profile.defaultCta, profile.tone);
        }

        const tags = `#${platform.toLowerCase()} #kontenkreator #${(topic || 'social').replace(/\s+/g, '').toLowerCase()}`;

        return {
          hook: selectedHook,
          topic,
          platform,
          format,
          objective,
          script,
          hashtags: tags,
          brandTone: profile.tone,
          engineMode: 'Heuristic Rule-Based V3'
        };
      },

      sendToPlanner: async (studioItem) => {
        const curProj = context.get().projectId || 'default-project';
        const payload = {
          title: `[AI Draft] ${studioItem.topic || 'Ide Konten'}`,
          platform: studioItem.platform || 'Instagram',
          format: studioItem.format || 'Video Reels',
          pillar: studioItem.objective === 'conversion' ? 'Promosi' : 'Edukasi',
          status: 'Ide',
          notes: `${studioItem.hook}\n\n${studioItem.script}\n\nTags:\n${studioItem.hashtags}`,
          projectId: curProj,
          createdAt: new Date().toISOString()
        };

        const result = await data.saveContent(payload);
        logger.info(`Konten studio berhasil didorong ke planner: ${payload.title}`);
        events.emit('content-ai:exported-to-planner', result);
        return result;
      }
    };

    return api;
  };

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('content-ai', ContentAIFactory, {
      name: 'AI Content Studio & Brand Intelligence',
      version: '2.0.0',
      dependencies: ['workspace-manager']
    });
  }
})(window);
