/**
 * Product calculators — NSX Manager, vCenter, VCF Operations, Aria Automation,
 * SDDC Manager, and Summary aggregation.
 */

const ProductCalculators = {

    /** Per-product override state (user overrides of auto-recommendations). */
    overrides: {
        nsxManager: {},       // { groupId: sizeOverride }
        vcenter: {},          // { domainId: sizeOverride }
        vcfOperations: { size: null, objectsOverride: null, ha: false },
        ariaAutomation: { enabled: false, cluster: false },
    },

    nsxManager: {
        calculate() {
            return DomainManager.getNsxManagerGroups().map(group => {
                const rec = SIZING_RULES.nsxManager.recommend(group.totalHosts);
                const ov = ProductCalculators.overrides.nsxManager[group.id];
                const size = ov || rec;
                const spec = SIZING_RULES.nsxManager.sizes[size];
                const count = SIZING_RULES.nsxManager.nodeCount;
                return {
                    groupId: group.id,
                    domains: group.domains,
                    totalHosts: group.totalHosts,
                    isManagement: group.isManagement,
                    recommended: rec,
                    size,
                    overridden: ov != null,
                    nodeCount: count,
                    resources: {
                        vcpu: spec.vcpu * count,
                        ram: spec.ram * count,
                        disk: spec.disk * count,
                    },
                };
            });
        },
    },

    vcenter: {
        calculate() {
            return DomainManager.getAllDomains().map(domain => {
                const isMgmt = domain.type === 'management';
                const rec = SIZING_RULES.vcenter.recommend(domain.hosts, domain.vms, isMgmt);
                const ov = ProductCalculators.overrides.vcenter[domain.id];
                const size = ov || rec;
                const spec = SIZING_RULES.vcenter.sizes[size];
                return {
                    domainId: domain.id,
                    domainName: domain.name,
                    hosts: domain.hosts,
                    vms: domain.vms,
                    isManagement: isMgmt,
                    recommended: rec,
                    size,
                    overridden: ov != null,
                    resources: { vcpu: spec.vcpu, ram: spec.ram, disk: spec.disk },
                };
            });
        },
    },

    vcfOperations: {
        calculate() {
            const totalH = DomainManager.getTotalHosts();
            const totalV = DomainManager.getTotalVms();
            const o = ProductCalculators.overrides.vcfOperations;
            const autoEstimate = SIZING_RULES.vcfOperations.estimateObjects(totalH, totalV);
            const est = o.objectsOverride || autoEstimate;
            const rec = SIZING_RULES.vcfOperations.recommend(est);
            const size = o.size || rec;
            const spec = SIZING_RULES.vcfOperations.sizes[size];
            const nodes = o.ha ? 2 : 1;
            return {
                totalHosts: totalH,
                totalVms: totalV,
                autoEstimate,
                estimatedObjects: est,
                recommended: rec,
                size,
                overridden: o.size != null,
                ha: o.ha,
                nodeCount: nodes,
                resources: {
                    vcpu: spec.vcpu * nodes,
                    ram: spec.ram * nodes,
                    disk: spec.disk * nodes,
                },
            };
        },
    },

    ariaAutomation: {
        calculate() {
            const o = ProductCalculators.overrides.ariaAutomation;
            if (!o.enabled) return null;
            const spec = SIZING_RULES.ariaAutomation.perNode;
            const nodes = o.cluster ? 3 : 1;
            return {
                enabled: true,
                cluster: o.cluster,
                nodeCount: nodes,
                resources: {
                    vcpu: spec.vcpu * nodes,
                    ram: spec.ram * nodes,
                    disk: spec.disk * nodes,
                },
            };
        },
    },

    sddcManager: {
        calculate() {
            return { resources: { ...SIZING_RULES.sddcManager.fixed } };
        },
    },

    /**
     * Aggregate all VMs into management domain vs workload domain categories.
     */
    summary: {
        calculate(edgeResults, nsxMgrResults, vcenterResults, vcfOpsResult, ariaResult, sddcResult) {
            const mgmt = [];
            const wkld = [];

            // SDDC Manager — always on management domain
            mgmt.push({ component: 'SDDC Manager', count: 1, ...sddcResult.resources });

            // vCenter — all vCenters run on the management domain
            for (const vc of vcenterResults) {
                mgmt.push({
                    component: 'vCenter \u2014 ' + vc.domainName,
                    count: 1,
                    size: vc.size,
                    ...vc.resources,
                });
            }

            // NSX Manager — all clusters run on the management domain
            for (const m of nsxMgrResults) {
                const names = m.domains.map(d => d.name).join(' + ');
                mgmt.push({
                    component: 'NSX Manager \u2014 ' + names,
                    count: m.nodeCount,
                    size: m.size,
                    ...m.resources,
                });
            }

            // VCF Operations — runs on management domain
            if (vcfOpsResult) {
                mgmt.push({
                    component: 'VCF Operations',
                    count: vcfOpsResult.nodeCount,
                    size: vcfOpsResult.size,
                    ...vcfOpsResult.resources,
                });
            }

            // Aria Automation — runs on management domain
            if (ariaResult) {
                mgmt.push({
                    component: 'Aria Automation',
                    count: ariaResult.nodeCount,
                    ...ariaResult.resources,
                });
            }

            // NSX Edge — runs on its respective domain
            for (const e of edgeResults) {
                if (!e.enabled) continue;
                const domain = DomainManager.getDomain(e.domainId);
                const entry = {
                    component: 'NSX Edge \u2014 ' + e.domainName,
                    count: e.nodeCount,
                    size: e.size,
                    ...e.resources,
                };
                if (domain && domain.type === 'management') {
                    mgmt.push(entry);
                } else {
                    wkld.push({ ...entry, domainName: e.domainName });
                }
            }

            const sum = arr => arr.reduce(
                (t, v) => ({ vcpu: t.vcpu + v.vcpu, ram: t.ram + v.ram, disk: t.disk + v.disk }),
                { vcpu: 0, ram: 0, disk: 0 }
            );

            const mgmtTotal = sum(mgmt);
            const wkldTotal = sum(wkld);

            return {
                managementVms: mgmt,
                workloadVms: wkld,
                mgmtTotal,
                wkldTotal,
                grandTotal: {
                    vcpu: mgmtTotal.vcpu + wkldTotal.vcpu,
                    ram: mgmtTotal.ram + wkldTotal.ram,
                    disk: mgmtTotal.disk + wkldTotal.disk,
                },
            };
        },
    },
};
