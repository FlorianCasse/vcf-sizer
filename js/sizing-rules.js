/**
 * VCF 9 Sizing Rules — data tables + recommend() functions.
 * Sources: Broadcom/VMware documentation — VMware Cloud Foundation 9.
 */

const SIZING_RULES = {

    nsxEdge: {
        sizes: {
            small:  { vcpu: 2,  ram: 4,   disk: 200, throughput: 2,  label: 'Small',       usage: 'PoC uniquement' },
            medium: { vcpu: 4,  ram: 8,   disk: 200, throughput: 10, label: 'Medium',      usage: 'Prod L2-L4' },
            large:  { vcpu: 8,  ram: 32,  disk: 200, throughput: 40, label: 'Large',       usage: 'Prod L2-L7' },
            xlarge: { vcpu: 16, ram: 64,  disk: 200, throughput: 80, label: 'Extra Large', usage: 'High throughput' },
        },
        sizeOrder: ['small', 'medium', 'large', 'xlarge'],

        serviceDegradation: {
            statefulFirewall: { small: 0.50, medium: 0.50, large: 0.50, xlarge: 0.50 },
            nat:              { small: 0.50, medium: 0.50, large: 0.50, xlarge: 0.50 },
            loadBalancer:     { small: 0.30, medium: 0.30, large: 0.30, xlarge: 0.30 },
            vpnIpsec:         { small: 0.15, medium: 0.20, large: 0.25, xlarge: 0.25 },
            dhcp:             { small: 0.90, medium: 0.90, large: 0.90, xlarge: 0.90 },
        },

        serviceLabels: {
            statefulFirewall: 'Pare-feu stateful',
            nat: 'NAT',
            loadBalancer: 'Load Balancer',
            vpnIpsec: 'VPN / IPsec',
            dhcp: 'DHCP Relay',
        },

        ecmpEfficiency: 0.85,

        gatewayLimits: {
            tier1Gateways:    { small: 16,   medium: 64,   large: 128,  xlarge: 256  },
            firewallRules:    { small: 2000, medium: 5000, large: 10000, xlarge: 20000 },
            natRules:         { small: 512,  medium: 1024, large: 2048,  xlarge: 4096 },
            lbVirtualServers: { small: 10,   medium: 20,   large: 40,   xlarge: 100  },
        },

        vks: {
            perCluster:              { tier1Gateways: 1, snatRules: 1, lbVirtualServers: 3 },
            perNamespaceWithIngress: { lbVirtualServers: 1 },
        },

        /**
         * Recommend edge size + node count for a given throughput target and services.
         * Returns null if no target specified.
         */
        recommend(targetGbps, services) {
            if (!targetGbps || targetGbps <= 0) return null;

            for (const size of this.sizeOrder) {
                const baseline = this.sizes[size].throughput;
                const factor = this._worstFactor(size, services);
                const perNode = baseline * factor;

                // Active-Standby: 1 active node
                if (perNode >= targetGbps) {
                    return { size, nodeCount: 2, haMode: 'activeStandby' };
                }

                // ECMP: multiple active nodes (not possible with VPN)
                if (!services.vpnIpsec) {
                    const n = Math.ceil(targetGbps / (perNode * this.ecmpEfficiency));
                    if (n >= 2 && n <= 8) {
                        return { size, nodeCount: n, haMode: 'activeActive' };
                    }
                }
            }

            return { size: 'xlarge', nodeCount: 8, haMode: 'activeActive' };
        },

        _worstFactor(size, services) {
            let worst = 1.0;
            for (const [svc, enabled] of Object.entries(services)) {
                if (!enabled) continue;
                const f = this.serviceDegradation[svc];
                if (f && f[size] < worst) worst = f[size];
            }
            return worst;
        },
    },

    nsxManager: {
        sizes: {
            small:  { vcpu: 4,  ram: 16, disk: 300, maxHosts: 10,  label: 'Small (PoC)'  },
            medium: { vcpu: 6,  ram: 24, disk: 300, maxHosts: 64,  label: 'Medium'        },
            large:  { vcpu: 12, ram: 48, disk: 300, maxHosts: 256, label: 'Large'         },
        },
        sizeOrder: ['small', 'medium', 'large'],
        nodeCount: 3,

        recommend(totalHosts) {
            // Small is PoC only — recommend Medium minimum for production
            if (totalHosts <= 64) return 'medium';
            return 'large';
        },
    },

    vcenter: {
        sizes: {
            tiny:   { vcpu: 2,  ram: 12, disk: 300,  maxHosts: 10,    maxVms: 100,   label: 'Tiny'        },
            small:  { vcpu: 4,  ram: 19, disk: 525,  maxHosts: 100,   maxVms: 1000,  label: 'Small'       },
            medium: { vcpu: 8,  ram: 28, disk: 745,  maxHosts: 400,   maxVms: 4000,  label: 'Medium'      },
            large:  { vcpu: 16, ram: 37, disk: 975,  maxHosts: 1000,  maxVms: 10000, label: 'Large'       },
            xlarge: { vcpu: 24, ram: 56, disk: 1180, maxHosts: 2000,  maxVms: 35000, label: 'Extra Large' },
        },
        sizeOrder: ['tiny', 'small', 'medium', 'large', 'xlarge'],

        recommend(hosts, vms, isManagementDomain) {
            // Management domain: minimum Small
            const minIdx = isManagementDomain ? 1 : 0;
            for (let i = minIdx; i < this.sizeOrder.length; i++) {
                const s = this.sizes[this.sizeOrder[i]];
                if (hosts <= s.maxHosts && vms <= s.maxVms) return this.sizeOrder[i];
            }
            return 'xlarge';
        },
    },

    vcfOperations: {
        sizes: {
            xsmall: { vcpu: 2,  ram: 8,   disk: 200,  maxObjects: 350,   label: 'Extra Small' },
            small:  { vcpu: 4,  ram: 16,  disk: 274,  maxObjects: 5000,  label: 'Small'       },
            medium: { vcpu: 8,  ram: 32,  disk: 514,  maxObjects: 15000, label: 'Medium'      },
            large:  { vcpu: 16, ram: 48,  disk: 812,  maxObjects: 22000, label: 'Large'       },
            xlarge: { vcpu: 24, ram: 128, disk: 1024, maxObjects: 50000, label: 'Extra Large' },
        },
        sizeOrder: ['xsmall', 'small', 'medium', 'large', 'xlarge'],

        estimateObjects(totalHosts, totalVms) {
            return totalHosts * 100 + totalVms * 5;
        },

        recommend(estimatedObjects) {
            for (const size of this.sizeOrder) {
                if (estimatedObjects <= this.sizes[size].maxObjects) return size;
            }
            return 'xlarge';
        },
    },

    vcfAutomation: {
        perNode: { vcpu: 24, ram: 54, disk: 128 },
    },

    sddcManager: {
        fixed: { vcpu: 4, ram: 16, disk: 500 },
    },

    pnic: {
        speeds: [10, 25, 40, 50, 100],
        defaultSpeed: 25,
        counts: [2, 4, 6, 8],
        defaultCount: 2,
        speedLabels: {
            10:  '10 GbE',
            25:  '25 GbE',
            40:  '40 GbE',
            50:  '50 GbE',
            100: '100 GbE',
        },
    },
};
