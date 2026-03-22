/**
 * Recommendations engine — evaluates sizing across all products and returns alerts.
 */

const RecommendationsEngine = {

    evaluate(edgeResults, nsxMgrResults, vcenterResults, vcfOpsResult) {
        const r = [];

        // ── NSX Edge recommendations (per domain) ──
        for (const e of edgeResults) {
            if (!e.enabled) continue;
            const p = '[' + e.domainName + '] ';
            const domain = DomainManager.getDomain(e.domainId);

            if (e.nodeCount < 2) {
                r.push({ severity: 'critical', message: p + 'Un minimum de 2 Edge Nodes est requis pour la haute disponibilité.' });
            }

            if (e.size === 'small' && (e.services.loadBalancer || e.services.vpnIpsec)) {
                r.push({ severity: 'warning', message: p + 'La taille Small n\'est pas recommandée pour les services Load Balancer ou VPN en production.' });
            }

            if (e.haMode === 'activeStandby' && e.nodeCount > 2) {
                r.push({ severity: 'info', message: p + 'En mode Active-Standby, seuls 2 nœuds sont utilisés. Les ' + (e.nodeCount - 2) + ' nœud(s) supplémentaire(s) sont inactifs.' });
            }

            if (e.services.vpnIpsec && e.haMode === 'activeActive') {
                r.push({ severity: 'warning', message: p + 'VPN/IPsec n\'est pas supporté en mode Active-Active (ECMP). Le débit utilise le mode Active-Standby pour le trafic VPN.' });
            }

            if (domain && domain.vksEnabled) {
                if (e.size === 'small') {
                    r.push({ severity: 'warning', message: p + 'La taille Small n\'est pas recommandée pour les déploiements VKS.' });
                }
                r.push({ severity: 'info', message: p + 'VKS requiert NAT et Load Balancer. Ces services ont été automatiquement activés.' });
            }

            if (domain && domain.edgeConfig.targetThroughput > 0 &&
                e.throughput.effectiveClusterGbps < domain.edgeConfig.targetThroughput) {
                r.push({
                    severity: 'warning',
                    message: p + 'Le débit effectif (' + e.throughput.effectiveClusterGbps +
                        ' Gbps) est inférieur à l\'objectif (' + domain.edgeConfig.targetThroughput +
                        ' Gbps). Envisagez une taille supérieure ou le mode Active-Active.',
                });
            }

            if (e.limits.tier1.exceeded) {
                r.push({ severity: 'critical', message: p + 'Le nombre de Tier-1 Gateways (' + e.limits.tier1.used + ') dépasse la limite (' + e.limits.tier1.max + ').' });
            }

            if (e.limits.lbVirtualServers.exceeded) {
                r.push({ severity: 'critical', message: p + 'Le nombre de LB Virtual Servers (' + e.limits.lbVirtualServers.used + ') dépasse la limite (' + e.limits.lbVirtualServers.max + ').' });
            }
        }

        // ── NSX Manager recommendations ──
        for (const m of nsxMgrResults) {
            const domainNames = m.domains.map(d => d.name).join(' + ');
            if (m.size === 'small') {
                r.push({ severity: 'warning', message: 'NSX Manager (' + domainNames + ') : la taille Small est réservée aux PoC (max 10 hôtes).' });
            }
            const maxH = SIZING_RULES.nsxManager.sizes[m.size].maxHosts;
            if (m.totalHosts > maxH) {
                r.push({ severity: 'critical', message: 'NSX Manager (' + domainNames + ') : ' + m.totalHosts + ' hôtes dépasse la capacité ' + m.size + ' (' + maxH + ').' });
            }
        }

        // ── vCenter recommendations ──
        for (const vc of vcenterResults) {
            const spec = SIZING_RULES.vcenter.sizes[vc.size];
            if (vc.hosts > spec.maxHosts) {
                r.push({ severity: 'critical', message: 'vCenter (' + vc.domainName + ') : ' + vc.hosts + ' hôtes dépasse la capacité ' + vc.size + ' (' + spec.maxHosts + ').' });
            }
            if (vc.vms > spec.maxVms) {
                r.push({ severity: 'critical', message: 'vCenter (' + vc.domainName + ') : ' + vc.vms + ' VMs dépasse la capacité ' + vc.size + ' (' + spec.maxVms + ').' });
            }
        }

        // ── VCF Operations recommendations ──
        if (vcfOpsResult) {
            const spec = SIZING_RULES.vcfOperations.sizes[vcfOpsResult.size];
            if (vcfOpsResult.estimatedObjects > spec.maxObjects) {
                r.push({ severity: 'warning', message: 'VCF Operations : ' + vcfOpsResult.estimatedObjects + ' objets estimés dépasse la capacité ' + vcfOpsResult.size + ' (' + spec.maxObjects + ').' });
            }
        }

        // ── Physical NIC recommendations ──
        for (const domain of DomainManager.getAllDomains()) {
            const bwPerHost = domain.pnicSpeed * domain.pnicCount;

            if (domain.pnicSpeed === 10) {
                r.push({ severity: 'info', message: '[' + domain.name + '] Les pNICs 10 GbE sont limitées. 25 GbE ou plus est recommandé pour les déploiements VCF en production.' });
            }

            // Edge throughput vs physical bandwidth
            if (domain.edgeEnabled) {
                const edge = edgeResults.find(e => e.domainId === domain.id);
                if (edge && edge.enabled && edge.throughput.effectiveClusterGbps > bwPerHost) {
                    r.push({
                        severity: 'warning',
                        message: '[' + domain.name + '] Le débit Edge effectif (' + edge.throughput.effectiveClusterGbps +
                            ' Gbps) dépasse la bande passante physique par hôte (' + bwPerHost + ' GbE). Augmentez la vitesse ou le nombre de pNICs.',
                    });
                }
            }
        }

        return r;
    },
};
