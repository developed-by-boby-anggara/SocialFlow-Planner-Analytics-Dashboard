# SOCIALFLOW V3 — FIREBASE DATA CONTRACT & PERSISTENCE RULES

## 1. Aturan Mutlak
1. Firebase Project ID tetap: `socialflow-planner-analytics`.
2. Koleksi utama yang digunakan adalah `contents`.
3. Dilarang melakukan migrasi massal destruktif atau menghapus koleksi aktif.
4. Seluruh field baru bersifat opsional (backward-compatible).

## 2. Skema Dokumen: Koleksi `contents`

Setiap dokumen konten dalam koleksi `contents` memiliki format data berikut:

```typescript
interface ContentDocument {
  // Identitas Dokumen
  id: string; // Format: 'cnt-{timestamp}'

  // Metadata Utama
  title: string;
  platform: 'Instagram' | 'TikTok' | 'Facebook';
  format: 'Video Reels' | 'Story' | 'Postingan Foto' | 'Desain Grafis' | 'Carousel' | 'TikTok Video' | 'Facebook Video' | 'Live Streaming';
  pillar: 'Edukasi' | 'Hiburan' | 'Promosi' | 'Testimoni' | 'Behind the Scenes' | 'Tips & Trik' | 'Inspirasi';
  status: 'Ide' | 'Brief' | 'Produksi' | 'Editing' | 'Siap Posting' | 'Terjadwal' | 'Published' | 'Cancelled';

  // Waktu (Strict 24 Jam WIB)
  scheduledDate: string; // Format: 'YYYY-MM-DD'
  scheduledTime: string; // Format: 'HH:mm' (00:00 - 23:59)

  // Konten & Aset
  caption?: string;
  hashtags?: string;
  referenceUrl?: string; // URL Link Referensi
  assetUrl?: string;     // URL File Materi (Google Drive / Cloud)

  // Metrik Performa (Angka Murni)
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;

  // Timestamps
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601

  // Field V3 Tambahan (Opsional)
  workspaceId?: string; // Default: 'default-workspace'
  clientId?: string;
}
