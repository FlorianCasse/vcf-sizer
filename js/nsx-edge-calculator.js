/**
 * NSX Edge sizing calculator — pure functions, no DOM access.
 * Uses SIZING_RULES for all data.
 */

const NsxEdgeCalculator = {

    /**
     * Auto-enable services required by VKS (NAT + Load Balancer).
     */
    autoEnableServices(services, vksEnabled) {
        if (!vksEnabled) return { ...services };
        return { ...services, nat: true, loadBalancer: true };
    },

    /**
     * Full edge calculation for a single domain.
     */
    calculateForDomain(domain) {
        if (!domain.edgeEnabled) {
            return { enabled: false, domainId: domain.id, domainName: domain.name };
        }

        const cfg = domain.edgeConfig;
        const services = this.autoEnableServices(cfg.services, domain.vksEnabled);
        const rec = SIZING_RULES.nsxEdge.recommend(cfg.targetThroughput, services);

        const size = cfg.sizeOverride || (rec ? rec.size : 'medium');
        const nodeCount = cfg.nodeCountOverride || (rec ? rec.nodeCount : 2);
        const haMode = cfg.haMode;

        const throughput = this.calculateThroughput(size, nodeCount, haMode, services);
        const gateways = this.calculateGatewayTopology(
            cfg.tier0Count, cfg.tier1Count,
            domain.vksEnabled, domain.vksClusters || 0, domain.vksNamespaces || 0
        );
        const limits = this.checkLimits(size, gateways);
        const spec = SIZING_RULES.nsxEdge.sizes[size];

        return {
            enabled: true,
            domainId: domain.id,
            domainName: domain.name,
            recommendation: rec,
            size,
            nodeCount,
            haMode,
            overridden: cfg.sizeOverride !== null,
            services,
            throughput,
            gateways,
            limits,
            resources: {
                vcpu: spec.vcpu * nodeCount,
                ram: spec.ram * nodeCount,
                disk: spec.disk * nodeCount,
            },
        };
    },

    /**
     * Calculate throughput analysis for a given edge configuration.
     */
    calculateThroughput(edgeSize, edgeCount, haMode, services) {
        const baseline = SIZING_RULES.nsxEdge.sizes[edgeSize].throughput;
        const breakdown = [];
        let worstFactor = 1.0;
        let worstService = null;

        for (const [svc, enabled] of Object.entries(services)) {
            if (!enabled) continue;
            const factors = SIZING_RULES.nsxEdge.serviceDegradation[svc];
            if (!factors) continue;
            const factor = factors[edgeSize];
            breakdown.push({
                service: svc,
                label: SIZING_RULES.nsxEdge.serviceLabels[svc],
                factor,
                resultGbps: Math.round(baseline * factor * 100) / 100,
            });
            if (factor < worstFactor) {
                worstFactor = factor;
                worstService = svc;
            }
        }

        const effectivePerNode = baseline * worstFactor;
        let activeNodes, effectiveCluster;

        if (haMode === 'activeStandby') {
            activeNodes = 1;
            effectiveCluster = effectivePerNode;
        } else if (services.vpnIpsec) {
            // VPN forces Active-Standby behavior even in ECMP mode
            activeNodes = 1;
            effectiveCluster = effectivePerNode;
        } else {
            activeNodes = edgeCount;
            effectiveCluster = effectivePerNode * edgeCount * SIZING_RULES.nsxEdge.ecmpEfficiency;
        }

        return {
            baselinePerNodeGbps: baseline,
            effectivePerNodeGbps: Math.round(effectivePerNode * 100) / 100,
            effectiveClusterGbps: Math.round(effectiveCluster * 100) / 100,
            worstFactor,
            worstServiceLabel: worstService
                ? SIZING_RULES.nsxEdge.serviceLabels[worstService]
                : null,
            activeNodes,
            breakdown,
        };
    },

    /**
     * Calculate gateway topology totals (including VKS-derived gateways).
     */
    calculateGatewayTopology(tier0Count, tier1Manual, vksEnabled, vksClusters, vksNamespaces) {
        let tier1Vks = 0, lbVks = 0, snatVks = 0;

        if (vksEnabled && vksClusters > 0) {
            const v = SIZING_RULES.nsxEdge.vks;
            tier1Vks = vksClusters * v.perCluster.tier1Gateways;
            lbVks = vksClusters * v.perCluster.lbVirtualServers
                  + vksNamespaces * v.perNamespaceWithIngress.lbVirtualServers;
            snatVks = vksClusters * v.perCluster.snatRules;
        }

        return {
            tier0Count,
            tier1Total: tier1Manual + tier1Vks,
            tier1Manual,
            tier1FromVks: tier1Vks,
            totalLbVirtualServers: lbVks,
            totalSnatRules: snatVks,
        };
    },

    /**
     * Check gateway counts against capacity limits for the given edge size.
     */
    checkLimits(edgeSize, gw) {
        const lim = SIZING_RULES.nsxEdge.gatewayLimits;
        return {
            tier1: {
                used: gw.tier1Total,
                max: lim.tier1Gateways[edgeSize],
                exceeded: gw.tier1Total > lim.tier1Gateways[edgeSize],
            },
            lbVirtualServers: {
                used: gw.totalLbVirtualServers,
                max: lim.lbVirtualServers[edgeSize],
                exceeded: gw.totalLbVirtualServers > lim.lbVirtualServers[edgeSize],
            },
            natRules: {
                used: gw.totalSnatRules,
                max: lim.natRules[edgeSize],
                exceeded: gw.totalSnatRules > lim.natRules[edgeSize],
            },
        };
    },
};
