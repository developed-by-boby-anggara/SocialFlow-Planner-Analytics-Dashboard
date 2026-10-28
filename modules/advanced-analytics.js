/**
 * SocialFlow V3 - Advanced Analytics, ROI & Affiliate Tracker
 * File: modules/advanced-analytics.js
 * Namespace: window.SocialFlow.Modules.AdvancedAnalytics
 */

(function (window) {
  'use strict';

  window.SocialFlow = window.SocialFlow || {};
  const SF = window.SocialFlow;

  const AnalyticsFactory = (core) => {
    const { logger, events, context, data } = core;

    let analyticsData = [];
    let affiliateData = [];
    let costRecords = [];

    const loadLocalAnalytics = () => {
      try {
        const storedAnl = localStorage.getItem('sf_v3_analytics');
        const storedAff = localStorage.getItem('sf_v3_affiliate');
        const storedCost = localStorage.getItem('sf_v3_costs');
        if (storedAnl) analyticsData = JSON.parse(storedAnl);
        if (storedAff) affiliateData = JSON.parse(storedAff);
        if (storedCost) costRecords = JSON.parse(storedCost);
      } catch (e) {
        logger.warn('Gagal membaca cache analitik & ROI lokal.');
      }
    };

    loadLocalAnalytics();

    const persistLocal = () => {
      try {
        localStorage.setItem('sf_v3_analytics', JSON.stringify(analyticsData));
        localStorage.setItem('sf_v3_affiliate', JSON.stringify(affiliateData));
        localStorage.setItem('sf_v3_costs', JSON.stringify(costRecords));
      } catch (e) {
        logger.warn('Gagal menyimpan cache analitik.');
      }
    };

    const api = {
      // 1. Math Safety Handlers (Proteksi Denominator 0 & Format Angka)
      calculateER: (interactions = 0, base = 0) => {
        if (!base || base <= 0) return 0;
        return Number(((interactions / base) * 100).toFixed(2));
      },

      calculateROI: (revenue = 0, totalCost = 0) => {
        if (!totalCost || totalCost <= 0) return 0;
        const netProfit = revenue - totalCost;
        return Number(((netProfit / totalCost) * 100).toFixed(2));
      },

      calculateROAS: (attributedRevenue = 0, adSpend = 0) => {
        if (!adSpend || adSpend <= 0) return 0;
        return Number((attributedRevenue / adSpend).toFixed(2));
      },

      // 2. Financial Record & ROI Operations
      addCostRecord: ({ category, amount, description = '', campaignId = null }) => {
        const curProj = context.get().projectId || 'default-project';
        const record = {
          id: `cost-${Date.now()}`,
          projectId: curProj,
          campaignId: campaignId || null,
          category: category || 'Production',
          amount: Math.max(0, Number(amount) || 0),
          description: description.trim(),
          recordedAt: new Date().toISOString()
        };

        costRecords.push(record);
        persistLocal();

        const db = data.getDb();
        if (db) {
          db.collection('cost_records').doc(record.id).set(record, { merge: true }).catch(() => {});
        }

        events.emit('cost:added', record);
        return record;
      },

      getFinancialSummaryByProject: (projectId, campaignId = null) => {
        const curProj = projectId || context.get().projectId || 'default-project';

        const costs = costRecords.filter(c => {
          const matchProj = c.projectId === curProj;
          const matchCamp = !campaignId || c.campaignId === campaignId;
          return matchProj && matchCamp;
        });

        const affs = affiliateData.filter(a => {
          const matchProj = a.projectId === curProj;
          const matchCamp = !campaignId || a.campaignId === campaignId;
          return matchProj && matchCamp;
        });

        const totalCost = costs.reduce((sum, item) => sum + item.amount, 0);
        const adSpend = costs.filter(c => c.category === 'AdSpend').reduce((sum, item) => sum + item.amount, 0);
        const totalCommission = affs.reduce((sum, item) => sum + item.commissionEarned, 0);
        const totalGrossRevenue = affs.reduce((sum, item) => sum + item.grossRevenue, 0);

        const netProfit = totalCommission - totalCost;
        const roi = api.calculateROI(totalCommission, totalCost);
        const roas = api.calculateROAS(totalGrossRevenue, adSpend);

        return {
          totalCost,
          adSpend,
          totalCommission,
          totalGrossRevenue,
          netProfit,
          roi,
          roas,
          currency: 'IDR'
        };
      },

      // 3. Affiliate Tracker
      recordAffiliateStats: ({ platform, affiliateCode, clicks, conversions, commissionEarned, grossRevenue, campaignId }) => {
        const curProj = context.get().projectId || 'default-project';
        const entry = {
          id: `aff-${Date.now()}`,
          projectId: curProj,
          campaignId: campaignId || null,
          platform: platform || 'TikTok Shop',
          affiliateCode: (affiliateCode || '').trim(),
          clicks: Math.max(0, Number(clicks) || 0),
          conversions: Math.max(0, Number(conversions) || 0),
          commissionEarned: Math.max(0, Number(commissionEarned) || 0),
          grossRevenue: Math.max(0, Number(grossRevenue) || 0),
          conversionRate: api.calculateER(conversions, clicks),
          sourceType: 'manual_input',
          recordedAt: new Date().toISOString()
        };

        affiliateData.push(entry);
        persistLocal();

        const db = data.getDb();
        if (db) {
          db.collection('affiliate_records').doc(entry.id).set(entry, { merge: true }).catch(() => {});
        }

        events.emit('affiliate:recorded', entry);
        return entry;
      },

      getAffiliateStatsByProject: (projectId) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        return affiliateData.filter(a => a.projectId === curProj);
      },

      // 4. Report Generator
      generateStructuredReport: (projectId) => {
        const curProj = projectId || context.get().projectId || 'default-project';
        const fin = api.getFinancialSummaryByProject(curProj);
        const affList = api.getAffiliateStatsByProject(curProj);

        return {
          generatedAt: new Date().toISOString(),
          projectId: curProj,
          financials: fin,
          affiliateRecordsCount: affList.length,
          topAffiliateCampaigns: affList.slice(-5)
        };
      }
    };

    return api;
  };

  if (SF.Core && SF.Core.Registry) {
    SF.Core.Registry.register('advanced-analytics', AnalyticsFactory, {
      name: 'Advanced Analytics & ROI Engine',
      version: '1.0.0',
      dependencies: ['workspace-manager']
    });
  }
})(window);
