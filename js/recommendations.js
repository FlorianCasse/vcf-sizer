/**
 * Recommendations engine — evaluates sizing inputs/outputs and returns alerts.
 */

const RecommendationsEngine = {

    evaluate(inputs, throughput, gateways, limits) {
        const results = [];

        // Edge count minimum
        if (inputs.edgeCount < 2) {
            results.push({
                severity: "critical",
                message: "Un minimum de 2 Edge Nodes est requis pour la haute disponibilité.",
            });
        }

        // Small edge with heavy services
        if (inputs.edgeSize === "small" && (inputs.services.loadBalancer || inputs.services.vpnIpsec)) {
            results.push({
                severity: "warning",
                message: "La taille Small n'est pas recommandée pour les services Load Balancer ou VPN en production.",
            });
        }

        // Active-Standby with extra nodes
        if (inputs.haMode === "activeStandby" && inputs.edgeCount > 2) {
            results.push({
                severity: "info",
                message: `En mode Active-Standby, seuls 2 nœuds sont utilisés. Les ${inputs.edgeCount - 2} nœud(s) supplémentaire(s) sont inactifs.`,
            });
        }

        // VPN incompatible with ECMP
        if (inputs.services.vpnIpsec && inputs.haMode === "activeActive") {
            results.push({
                severity: "warning",
                message: "VPN/IPsec n'est pas supporté en mode Active-Active (ECMP). Le calcul de débit utilise le mode Active-Standby pour le trafic VPN.",
            });
        }

        // VKS with small edges
        if (inputs.vksEnabled && inputs.edgeSize === "small") {
            results.push({
                severity: "warning",
                message: "La taille Small n'est pas recommandée pour les déploiements VKS.",
            });
        }

        // VKS auto-enabled services
        if (inputs.vksEnabled) {
            results.push({
                severity: "info",
                message: "VKS requiert NAT (SNAT pour l'egress des pods) et Load Balancer (API Server K8s). Ces services ont été automatiquement activés.",
            });
        }

        // Target throughput not met
        if (inputs.targetThroughput > 0 && throughput.effectiveClusterGbps < inputs.targetThroughput) {
            results.push({
                severity: "warning",
                message: `Le débit effectif (${throughput.effectiveClusterGbps} Gbps) est inférieur à l'objectif (${inputs.targetThroughput} Gbps). Envisagez une taille supérieure ou le mode Active-Active.`,
            });
        }

        // Gateway limits exceeded
        if (limits.tier1.exceeded) {
            results.push({
                severity: "critical",
                message: `Le nombre de Tier-1 Gateways (${limits.tier1.used}) dépasse la limite supportée (${limits.tier1.max}) pour la taille ${inputs.edgeSize}.`,
            });
        }

        if (limits.lbVirtualServers.exceeded) {
            results.push({
                severity: "critical",
                message: `Le nombre de LB Virtual Servers (${limits.lbVirtualServers.used}) dépasse la limite supportée (${limits.lbVirtualServers.max}) pour la taille ${inputs.edgeSize}.`,
            });
        }

        return results;
    },
};
