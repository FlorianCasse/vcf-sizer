/**
 * NSX Edge sizing reference data.
 * Sources: VMware NSX documentation & VCF sizing guides.
 */

const NSX_EDGE_DATA = {
    // Baseline throughput per edge node (routing only, no services)
    throughput: {
        small:  { gbps: 2 },
        medium: { gbps: 10 },
        large:  { gbps: 40 },
        xlarge: { gbps: 80 },
    },

    // Throughput degradation factors per service (multiplier 0.0–1.0)
    // When multiple services are enabled, the worst factor (minimum) applies.
    serviceDegradation: {
        statefulFirewall: { small: 0.50, medium: 0.50, large: 0.50, xlarge: 0.50 },
        nat:              { small: 0.50, medium: 0.50, large: 0.50, xlarge: 0.50 },
        loadBalancer:     { small: 0.30, medium: 0.30, large: 0.30, xlarge: 0.30 },
        vpnIpsec:         { small: 0.15, medium: 0.20, large: 0.25, xlarge: 0.25 },
        dhcp:             { small: 0.90, medium: 0.90, large: 0.90, xlarge: 0.90 },
    },

    // Service display labels (French)
    serviceLabels: {
        statefulFirewall: "Pare-feu stateful",
        nat: "NAT",
        loadBalancer: "Load Balancer",
        vpnIpsec: "VPN / IPsec",
        dhcp: "DHCP Relay",
    },

    // ECMP efficiency factor (traffic distribution is never perfectly even)
    ecmpEfficiency: 0.85,

    // Gateway capacity limits per edge size (VMware Configuration Maximums)
    gatewayLimits: {
        tier1Gateways:    { small: 16,   medium: 64,   large: 128,  xlarge: 256 },
        firewallRules:    { small: 2000, medium: 5000, large: 10000, xlarge: 20000 },
        natRules:         { small: 512,  medium: 1024, large: 2048,  xlarge: 4096 },
        lbVirtualServers: { small: 10,   medium: 20,   large: 40,   xlarge: 100 },
    },

    // VKS integration: resources consumed per K8s cluster
    vks: {
        perCluster: {
            tier1Gateways: 1,
            snatRules: 1,
            lbVirtualServers: 3,
        },
        perNamespaceWithIngress: {
            lbVirtualServers: 1,
        },
    },
};
