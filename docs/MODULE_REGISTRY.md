# SOCIALFLOW V3 — MODULE REGISTRY & INTEGRATION CONTRACTS

Dokumen ini mendefinisikan tanggung jawab, antarmuka (API), dan aturan interaksi antar modul untuk mencegah duplikasi logika bisnis atau kebocoran state.

## Registry Modul

### 1. Modul: Content AI Studio
- **File Target:** `modules/content-ai.js`
- **Namespace:** `window.SocialFlow.Modules.ContentAI`
- **Tanggung Jawab:**
  - Menghasilkan variasi hook 3 detik pembuka video berdasarkan pilar konten.
  - Memformat draft caption terstruktur dengan Call-to-Action (CTA) dan rekomendasi hashtag.
- **Kontrak Input:**
  ```javascript
  {
    topic: String,
    platform: 'Instagram' | 'TikTok' | 'Facebook',
    format: String,
    pillar: String
  }
  {
  hook: String,
  caption: String,
  suggestedHashtags: String
}
