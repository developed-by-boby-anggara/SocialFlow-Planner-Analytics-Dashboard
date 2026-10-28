# SOCIALFLOW V3 — SYSTEM ARCHITECTURE & BLUEPRINT

## 1. Ikhtisar Sistem
SocialFlow V3 adalah evolusi bertahap dari dashboard SocialFlow (v2.5.1) menuju platform enterprise media management multi-project, multi-client, dan content studio tanpa merusak stabilitas runtime yang sudah ada.

## 2. Baseline Lingkungan Eksekusi
- **Entry Point:** `index.html` (dijalankan via GitHub Pages).
- **Runtime Transpiler:** Babel Standalone (`@babel/standalone`) via browser script tag.
- **UI & State Framework:** React 18 (UMD global via CDN) dengan functional hooks (`useState`, `useEffect`, `useMemo`).
- **Styling:** Tailwind CSS via runtime CDN script.
- **Persistence:** Firebase Cloud Firestore SDK v10.12.2 (Compat mode) dengan fallback `localStorage`.
- **Target Browser Resolution:** Responsif dinamis (Mode Mobile <= 768px dan Mode Desktop Web > 768px).

## 3. Pola Arsitektur Modular (Browser Namespaced Pattern)
Untuk mengatasi token limit obrolan AI serta mencegah browser crash akibat file monolitik raksasa, V3 menggunakan pola arsitektur modular terdistribusi berbasis namespace browser:

```javascript
window.SocialFlow = window.SocialFlow || {};
window.SocialFlow.Modules = window.SocialFlow.Modules || {};
<!-- Struktur Pemuatan Skrip di index.html -->
<script type="text/babel" src="modules/content-ai.js"></script>
<script type="text/babel" src="modules/workflow-tracker.js"></script>
<script type="text/babel" src="modules/target-matrix.js"></script>
