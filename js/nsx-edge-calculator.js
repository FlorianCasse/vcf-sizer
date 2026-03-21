/**
 * NSX Edge sizing calculator — pure functions, no DOM access.
 */

const NsxEdgeCalculator = {

    /**
     * Auto-enable services required by VKS.
     * Returns a new services object with NAT and LB forced on if VKS is enabled.
     */
    autoEnableServices(services, vksEnabled) {
        if (!vksEnabled) return { ...services };
        return {
            ...services,
            nat: true,
            loadBalancer: true,
        };
    },

    /**
     * Calculate throughput analysis.
     */
    calculateThroughput(edgeSize, edgeCount, haMode, enabledServices) {
        const baseline = NSX_EDGE_DATA.throughput[edgeSize].gbps;

        // Build degradation breakdown for each enabled service
        const breakdown = [];
        let worstFactor = 1.0;
        let worstService = null;

        for (const [service, enabled] of Object.entries(enabledServices)) {
            if (!enabled) continue;
            const factors = NSX_EDGE_DATA.serviceDegradation[service];
            if (!factors) continue;

            const factor = factors[edgeSize];
            const resultGbps = baseline * factor;
            breakdown.push({
                service,
                label: NSX_EDGE_DATA.serviceLabels[service],
                factor,
                resultGbps,
            });

            if (factor < worstFactor) {
                worstFactor = factor;
                worstService = service;
            }
        }

        const effectivePerNode = baseline * worstFactor;

        // HA mode: Active-Standby = 1 node, Active-Active = N nodes * ECMP efficiency
        let effectiveCluster;
        let activeNodes;
        if (haMode === "activeStandby") {
            effectiveCluster = effectivePerNode;
            activeNodes = 1;
        } else {
            // VPN/IPsec forces Active-Standby behavior
            if (enabledServices.vpnIpsec) {
                effectiveCluster = effectivePerNode;
                activeNodes = 1;
            } else {
                activeNodes = edgeCount;
                effectiveCluster = effectivePerNode * edgeCount * NSX_EDGE_DATA.ecmpEfficiency;
            }
        }

        return {
            baselinePerNodeGbps: baseline,
            effectivePerNodeGbps: effectivePerNode,
            effectiveClusterGbps: Math.round(effectiveCluster * 100) / 100,
            worstFactor,
            worstServiceLabel: worstService ? NSX_EDGE_DATA.serviceLabels[worstService] : null,
            activeNodes,
            breakdown,
        };
    },

    /**
     * Calculate gateway topology totals (including VKS-derived gateways).
     */
    calculateGatewayTopology(tier0Count, tier1CountManual, vksEnabled, vksClusters, vksNamespacesIngress) {
        let tier1FromVks = 0;
        let lbVsFromVks = 0;
        let snatFromVks = 0;

        if (vksEnabled && vksClusters > 0) {
            const vks = NSX_EDGE_DATA.vks;
            tier1FromVks = vksClusters * vks.perCluster.tier1Gateways;
            lbVsFromVks = (vksClusters * vks.perCluster.lbVirtualServers)
                        + (vksNamespacesIngress * vks.perNamespaceWithIngress.lbVirtualServers);
            snatFromVks = vksClusters * vks.perCluster.snatRules;
        }

        return {
            tier0Count,
            tier1Total: tier1CountManual + tier1FromVks,
            tier1Manual: tier1CountManual,
            tier1FromVks,
            totalLbVirtualServers: lbVsFromVks,
            totalSnatRules: snatFromVks,
        };
    },

    /**
     * Calculate edge node resource requirements.
     */
    calculateResources(edgeSize, edgeCount) {
        const spec = SIZING_DATA.nsxEdge.sizes[edgeSize];
        return {
            vcpu: spec.vcpu * edgeCount,
            ram: spec.ram * edgeCount,
            disk: spec.disk * edgeCount,
            perNode: { ...spec },
        };
    },

    /**
     * Check values against gateway capacity limits.
     */
    checkLimits(edgeSize, gatewayTopology) {
        const limits = NSX_EDGE_DATA.gatewayLimits;
        return {
            tier1: {
                used: gatewayTopology.tier1Total,
                max: limits.tier1Gateways[edgeSize],
                exceeded: gatewayTopology.tier1Total > limits.tier1Gateways[edgeSize],
            },
            lbVirtualServers: {
                used: gatewayTopology.totalLbVirtualServers,
                max: limits.lbVirtualServers[edgeSize],
                exceeded: gatewayTopology.totalLbVirtualServers > limits.lbVirtualServers[edgeSize],
            },
            natRules: {
                used: gatewayTopology.totalSnatRules,
                max: limits.natRules[edgeSize],
                exceeded: gatewayTopology.totalSnatRules > limits.natRules[edgeSize],
            },
        };
    },
};
