getAccounts: function (projectId) {
        const pid = projectId || this.getActiveProjectId();
        const raw = localStorage.getItem(`sf_accounts_${pid}`);
        return raw ? JSON.parse(raw) : {
          instagram: '@chocoovora',
          tiktok: '@chocoovora.style',
          facebook: 'Chocoovora Official',
          youtube: 'Chocoovora Channel',
          shopee: 'Chocoovora Official Shop'
        };
      },

      syncUI: function () {
        const pid = this.getActiveProjectId();
        const acc = this.getAccounts(pid);

        const igBadge = document.getElementById('sf-account-ig-badge');
        if (igBadge) igBadge.textContent = acc.instagram || '-';

        const ttBadge = document.getElementById('sf-account-tt-badge');
        if (ttBadge) ttBadge.textContent = acc.tiktok || '-';

        const fbBadge = document.getElementById('sf-account-fb-badge');
        if (fbBadge) fbBadge.textContent = acc.facebook || '-';

        const ytBadge = document.getElementById('sf-account-yt-badge');
        if (ytBadge) ytBadge.textContent = acc.youtube || '-';

        const spBadge = document.getElementById('sf-account-shopee-badge');
        if (spBadge) spBadge.textContent = acc.shopee || '-';
      },

      promptEditAccounts: function () {
        const pid = this.getActiveProjectId();
        const curr = this.getAccounts(pid);

        const newIg = prompt(`[${pid}] Masukkan Username Instagram:`, curr.instagram);
        if (newIg === null) return;

        const newTt = prompt(`[${pid}] Masukkan Username TikTok:`, curr.tiktok);
        if (newTt === null) return;

        const newFb = prompt(`[${pid}] Masukkan Nama/Page Facebook:`, curr.facebook);
        if (newFb === null) return;

        const newYt = prompt(`[${pid}] Masukkan Channel YouTube:`, curr.youtube || '');
        if (newYt === null) return;

        const newSp = prompt(`[${pid}] Masukkan Nama Akun/Toko Shopee:`, curr.shopee || '');
        if (newSp === null) return;

        this.setAccounts({
          instagram: newIg.trim(),
          tiktok: newTt.trim(),
          facebook: newFb.trim(),
          youtube: newYt.trim(),
          shopee: newSp.trim()
        }, pid);
      }
