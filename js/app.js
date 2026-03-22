/**
 * App — UI controller: reactive rendering, domain UI, tab rendering, event wiring.
 */

const App = {
    activeTab: 'summary',

    // Calculation results (updated by recalculate)
    edgeResults: [],
    nsxMgrResults: [],
    vcenterResults: [],
    vcfOpsResult: null,
    ariaResult: null,
    sddcResult: null,
    summaryResult: null,
    recommendations: [],

    // ── Initialization ──

    init() {
        DomainManager.init();
        DomainManager.subscribe(structureChanged => {
            if (structureChanged) this.renderEnvironment();
            this.recalculate();
        });
        this.renderEnvironment();
        this.bindGlobalEvents();
        this.recalculate();
    },

    // ── Event Binding ──

    bindGlobalEvents() {
        // Tab switching
        document.getElementById('main-tabs').addEventListener('click', e => {
            const tab = e.target.closest('.tab');
            if (!tab) return;
            document.querySelectorAll('#main-tabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            this.activeTab = tab.dataset.tab;
            this.renderActiveTab();
        });

        // Add workload domain
        document.getElementById('add-domain-btn').addEventListener('click', () => {
            const count = DomainManager.getWorkloadDomains().length + 1;
            DomainManager.addWorkloadDomain('Workload Domain ' + count);
        });

        // Environment section collapse
        document.getElementById('env-toggle').addEventListener('click', () => {
            const body = document.getElementById('env-body');
            const btn = document.getElementById('env-toggle');
            body.classList.toggle('hidden');
            btn.innerHTML = body.classList.contains('hidden') ? '&#9660;' : '&#9650;';
        });

        // Domain cards — event delegation
        const cards = document.getElementById('domain-cards');
        cards.addEventListener('input', e => this.handleDomainInput(e));
        cards.addEventListener('change', e => this.handleDomainChange(e));
        cards.addEventListener('click', e => {
            if (e.target.closest('.btn-delete-domain')) {
                const card = e.target.closest('.domain-card');
                if (card) DomainManager.removeDomain(card.dataset.domainId);
            }
        });

        // Tab content — event delegation
        const tc = document.getElementById('tab-content');
        tc.addEventListener('change', e => this.handleTabChange(e));
        tc.addEventListener('input', e => this.handleTabInput(e));
    },

    // ── Domain Card Event Handlers ──

    handleDomainInput(e) {
        const card = e.target.closest('.domain-card');
        if (!card) return;
        const id = card.dataset.domainId;

        if (e.target.matches('.domain-hosts')) {
            DomainManager.updateDomain(id, { hosts: parseInt(e.target.value) || 0 });
        } else if (e.target.matches('.domain-vms')) {
            DomainManager.updateDomain(id, { vms: parseInt(e.target.value) || 0 });
        } else if (e.target.matches('.domain-name')) {
            DomainManager.updateDomain(id, { name: e.target.value });
        } else if (e.target.matches('.domain-vks-clusters')) {
            DomainManager.updateDomain(id, { vksClusters: parseInt(e.target.value) || 1 });
        } else if (e.target.matches('.domain-vks-namespaces')) {
            DomainManager.updateDomain(id, { vksNamespaces: parseInt(e.target.value) || 0 });
        }
    },

    handleDomainChange(e) {
        const card = e.target.closest('.domain-card');
        if (!card) return;
        const id = card.dataset.domainId;

        if (e.target.matches('.domain-vks')) {
            DomainManager.updateDomain(id, { vksEnabled: e.target.checked });
            const cfg = card.querySelector('.vks-config');
            if (cfg) cfg.classList.toggle('hidden', !e.target.checked);
        } else if (e.target.matches('.domain-nsx-sharing')) {
            DomainManager.updateDomain(id, { nsxManagerSharing: e.target.value });
        } else if (e.target.matches('.domain-pnic-speed')) {
            DomainManager.updateDomain(id, { pnicSpeed: parseInt(e.target.value) });
        } else if (e.target.matches('.domain-pnic-count')) {
            DomainManager.updateDomain(id, { pnicCount: parseInt(e.target.value) });
        }
    },

    // ── Tab Content Event Handlers ──

    handleTabChange(e) {
        // NSX Edge domain panels
        const edgePanel = e.target.closest('.edge-domain-panel');
        if (edgePanel) {
            const domainId = edgePanel.dataset.domainId;
            if (e.target.matches('.edge-enabled-toggle')) {
                DomainManager.updateDomain(domainId, { edgeEnabled: e.target.checked });
                this.renderActiveTab();
                return;
            }
            if (e.target.matches('.edge-size-override')) {
                const val = e.target.value;
                DomainManager.updateDomain(domainId, { edgeConfig: { sizeOverride: val === '' ? null : val } });
                return;
            }
            if (e.target.matches('.edge-node-override')) {
                const val = parseInt(e.target.value);
                DomainManager.updateDomain(domainId, { edgeConfig: { nodeCountOverride: isNaN(val) ? null : val } });
                return;
            }
            if (e.target.matches('.edge-ha-mode')) {
                DomainManager.updateDomain(domainId, { edgeConfig: { haMode: e.target.value } });
                return;
            }
            if (e.target.matches('.edge-svc')) {
                const svc = e.target.dataset.service;
                DomainManager.updateDomain(domainId, { services: { [svc]: e.target.checked } });
                return;
            }
        }

        // Product overrides
        if (e.target.matches('.nsx-mgr-override')) {
            const val = e.target.value;
            ProductCalculators.overrides.nsxManager[e.target.dataset.groupId] = val === '' ? null : val;
            this.recalculate();
        }
        if (e.target.matches('.vcenter-override')) {
            const val = e.target.value;
            ProductCalculators.overrides.vcenter[e.target.dataset.domainId] = val === '' ? null : val;
            this.recalculate();
        }
        if (e.target.matches('.vcfops-size-override')) {
            const val = e.target.value;
            ProductCalculators.overrides.vcfOperations.size = val === '' ? null : val;
            this.recalculate();
        }
        if (e.target.matches('.vcfops-ha')) {
            ProductCalculators.overrides.vcfOperations.ha = e.target.checked;
            this.recalculate();
        }
        if (e.target.matches('.aria-enabled')) {
            ProductCalculators.overrides.ariaAutomation.enabled = e.target.checked;
            this.recalculate();
        }
        if (e.target.matches('.aria-cluster')) {
            ProductCalculators.overrides.ariaAutomation.cluster = e.target.checked;
            this.recalculate();
        }
    },

    handleTabInput(e) {
        const edgePanel = e.target.closest('.edge-domain-panel');
        if (edgePanel) {
            const domainId = edgePanel.dataset.domainId;
            if (e.target.matches('.edge-throughput')) {
                DomainManager.updateDomain(domainId, { edgeConfig: { targetThroughput: parseFloat(e.target.value) || 0 } });
                return;
            }
            if (e.target.matches('.edge-tier0')) {
                DomainManager.updateDomain(domainId, { edgeConfig: { tier0Count: parseInt(e.target.value) || 1 } });
                return;
            }
            if (e.target.matches('.edge-tier1')) {
                DomainManager.updateDomain(domainId, { edgeConfig: { tier1Count: parseInt(e.target.value) || 0 } });
                return;
            }
        }
        if (e.target.matches('.vcfops-objects-override')) {
            const val = parseInt(e.target.value);
            ProductCalculators.overrides.vcfOperations.objectsOverride = (isNaN(val) || val <= 0) ? null : val;
            this.recalculate();
        }
    },

    // ── Calculation ──

    recalculate() {
        const domains = DomainManager.getAllDomains();
        this.edgeResults = domains.map(d => NsxEdgeCalculator.calculateForDomain(d));
        this.nsxMgrResults = ProductCalculators.nsxManager.calculate();
        this.vcenterResults = ProductCalculators.vcenter.calculate();
        this.vcfOpsResult = ProductCalculators.vcfOperations.calculate();
        this.ariaResult = ProductCalculators.ariaAutomation.calculate();
        this.sddcResult = ProductCalculators.sddcManager.calculate();
        this.summaryResult = ProductCalculators.summary.calculate(
            this.edgeResults, this.nsxMgrResults, this.vcenterResults,
            this.vcfOpsResult, this.ariaResult, this.sddcResult
        );
        this.recommendations = RecommendationsEngine.evaluate(
            this.edgeResults, this.nsxMgrResults, this.vcenterResults,
            this.vcfOpsResult, this.ariaResult
        );
        this.renderActiveTab();
    },

    // ── Rendering ──

    renderEnvironment() {
        let html = '';
        for (const d of DomainManager.getAllDomains()) {
            html += this.renderDomainCard(d);
        }
        document.getElementById('domain-cards').innerHTML = html;
    },

    renderDomainCard(d) {
        const isMgmt = d.type === 'management';
        const sharingTargets = isMgmt ? [] : DomainManager.getSharingTargets(d.id);

        let sharingOpts = '<option value="dedicated"' + (d.nsxManagerSharing === 'dedicated' ? ' selected' : '') + '>Dédié</option>';
        for (const t of sharingTargets) {
            sharingOpts += '<option value="' + t.id + '"' + (d.nsxManagerSharing === t.id ? ' selected' : '') + '>Partagé avec ' + this.esc(t.name) + '</option>';
        }

        return '<div class="domain-card" data-domain-id="' + d.id + '">' +
            '<div class="domain-header">' +
            (isMgmt
                ? '<span class="domain-title">' + this.esc(d.name) + '</span>'
                : '<input type="text" class="domain-name" value="' + this.esc(d.name) + '">') +
            (isMgmt ? '' : '<button class="btn-delete-domain" title="Supprimer">\u2715</button>') +
            '</div>' +
            '<div class="domain-body">' +
                '<div class="form-row">' +
                    '<div class="form-group">' +
                        '<label>Hôtes ESXi</label>' +
                        '<input type="number" class="domain-hosts" min="' + (isMgmt ? 4 : 2) + '" value="' + d.hosts + '">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>' + (isMgmt ? 'VMs workload (optionnel)' : 'VMs attendues') + '</label>' +
                        '<input type="number" class="domain-vms" min="0" value="' + d.vms + '">' +
                    '</div>' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group">' +
                        '<label>Vitesse pNIC</label>' +
                        '<select class="domain-pnic-speed">' +
                        SIZING_RULES.pnic.speeds.map(s =>
                            '<option value="' + s + '"' + (d.pnicSpeed === s ? ' selected' : '') + '>' +
                            SIZING_RULES.pnic.speedLabels[s] + '</option>'
                        ).join('') +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>pNICs / hôte</label>' +
                        '<select class="domain-pnic-count">' +
                        SIZING_RULES.pnic.counts.map(c =>
                            '<option value="' + c + '"' + (d.pnicCount === c ? ' selected' : '') + '>' + c + '</option>'
                        ).join('') +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<span class="hint">' + (d.pnicSpeed * d.pnicCount) + ' GbE / hôte \u2014 ' +
                    (d.pnicSpeed * d.pnicCount * d.hosts) + ' GbE total domaine</span>' +
                (isMgmt ? '' :
                    '<div class="form-group">' +
                        '<label>NSX Manager</label>' +
                        '<select class="domain-nsx-sharing">' + sharingOpts + '</select>' +
                    '</div>'
                ) +
                '<div class="form-group">' +
                    '<label class="checkbox-inline"><input type="checkbox" class="domain-vks"' + (d.vksEnabled ? ' checked' : '') + '> VKS activé</label>' +
                '</div>' +
                '<div class="vks-config' + (d.vksEnabled ? '' : ' hidden') + '">' +
                    '<div class="form-row">' +
                        '<div class="form-group">' +
                            '<label>Clusters K8s</label>' +
                            '<input type="number" class="domain-vks-clusters" min="1" value="' + (d.vksClusters || 1) + '">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>Namespaces avec Ingress</label>' +
                            '<input type="number" class="domain-vks-namespaces" min="0" value="' + (d.vksNamespaces || 5) + '">' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    renderActiveTab() {
        const container = document.getElementById('tab-content');

        // Save focused element info for restore after re-render
        const active = document.activeElement;
        let focusInfo = null;
        if (active && container.contains(active)) {
            const panel = active.closest('[data-domain-id]');
            focusInfo = {
                classes: active.className,
                domainId: panel ? panel.dataset.domainId : null,
                selStart: active.selectionStart,
                selEnd: active.selectionEnd,
            };
        }

        // Render tab content
        switch (this.activeTab) {
            case 'summary':        container.innerHTML = this.renderSummary(); break;
            case 'nsx-edge':       container.innerHTML = this.renderNsxEdge(); break;
            case 'nsx-manager':    container.innerHTML = this.renderNsxManager(); break;
            case 'vcenter':        container.innerHTML = this.renderVcenter(); break;
            case 'vcf-operations': container.innerHTML = this.renderVcfOps(); break;
            case 'aria-automation':container.innerHTML = this.renderAria(); break;
            case 'sddc-manager':   container.innerHTML = this.renderSddc(); break;
        }

        // Restore focus
        if (focusInfo) {
            const mainClass = focusInfo.classes.split(' ')[0];
            let selector = '.' + mainClass;
            if (focusInfo.domainId) {
                selector = '[data-domain-id="' + focusInfo.domainId + '"] ' + selector;
            }
            const el = container.querySelector(selector);
            if (el) {
                el.focus();
                try {
                    if (focusInfo.selStart != null) {
                        el.selectionStart = focusInfo.selStart;
                        el.selectionEnd = focusInfo.selEnd;
                    }
                } catch (_) { /* select elements don't support selectionStart */ }
            }
        }
    },

    // ── Tab Renderers ──

    renderSummary() {
        const s = this.summaryResult;
        if (!s) return '';

        let html = '<div class="summary-section">';

        // Management domain VMs
        html += '<h3>VMs sur le Management Domain</h3>';
        html += '<table class="summary-table"><thead><tr>' +
            '<th>Composant</th><th>Instances</th><th>vCPU</th><th>RAM (GB)</th><th>Disque (GB)</th>' +
            '</tr></thead><tbody>';
        for (const vm of s.managementVms) {
            html += '<tr><td>' + vm.component +
                (vm.size ? ' <span class="size-badge">' + vm.size + '</span>' : '') +
                '</td><td>' + (vm.count || 1) +
                '</td><td>' + vm.vcpu +
                '</td><td>' + vm.ram +
                '</td><td>' + vm.disk + '</td></tr>';
        }
        html += '<tr class="total-row"><td>Sous-total Management</td><td></td>' +
            '<td>' + s.mgmtTotal.vcpu + '</td><td>' + s.mgmtTotal.ram + '</td><td>' + s.mgmtTotal.disk + '</td></tr>';
        html += '</tbody></table>';

        // Workload domain VMs
        if (s.workloadVms.length > 0) {
            html += '<h3>VMs sur les Workload Domains</h3>';
            html += '<table class="summary-table"><thead><tr>' +
                '<th>Composant</th><th>Instances</th><th>vCPU</th><th>RAM (GB)</th><th>Disque (GB)</th>' +
                '</tr></thead><tbody>';
            for (const vm of s.workloadVms) {
                html += '<tr><td>' + vm.component +
                    (vm.size ? ' <span class="size-badge">' + vm.size + '</span>' : '') +
                    '</td><td>' + (vm.count || 1) +
                    '</td><td>' + vm.vcpu +
                    '</td><td>' + vm.ram +
                    '</td><td>' + vm.disk + '</td></tr>';
            }
            html += '<tr class="total-row"><td>Sous-total Workload</td><td></td>' +
                '<td>' + s.wkldTotal.vcpu + '</td><td>' + s.wkldTotal.ram + '</td><td>' + s.wkldTotal.disk + '</td></tr>';
            html += '</tbody></table>';
        }

        html += '</div>';

        // Grand total
        html += '<div class="totals">' +
            '<h3>Total global des ressources</h3>' +
            '<div class="specs">' +
            this.specItem(s.grandTotal.vcpu, 'vCPU') +
            this.specItem(s.grandTotal.ram + ' GB', 'RAM') +
            this.specItem(s.grandTotal.disk + ' GB', 'Disque') +
            '</div></div>';

        // Network bandwidth summary
        if (s.networkSummary && s.networkSummary.length > 0) {
            html += '<div class="summary-section">';
            html += '<h3>Capacité réseau physique (pNICs)</h3>';
            html += '<table class="summary-table"><thead><tr>' +
                '<th>Domaine</th><th>Hôtes</th><th>pNICs / hôte</th><th>Vitesse</th><th>BP / hôte (GbE)</th><th>BP totale (GbE)</th>' +
                '</tr></thead><tbody>';
            let totalBw = 0;
            for (const n of s.networkSummary) {
                totalBw += n.totalBandwidth;
                html += '<tr><td>' + n.domainName + '</td><td>' + n.hosts +
                    '</td><td>' + n.pnicCount + '</td><td>' + n.pnicSpeed + ' GbE</td><td>' +
                    n.bandwidthPerHost + '</td><td>' + n.totalBandwidth + '</td></tr>';
            }
            html += '<tr class="total-row"><td>Total</td><td>' + DomainManager.getTotalHosts() +
                '</td><td></td><td></td><td></td><td>' + totalBw + '</td></tr>';
            html += '</tbody></table></div>';
        }

        // Recommendations
        if (this.recommendations.length > 0) {
            html += '<div class="recommendations-section">';
            html += '<h3>Recommandations</h3>';
            html += this.renderRecommendations(this.recommendations);
            html += '</div>';
        }

        return html;
    },

    renderNsxEdge() {
        let html = '';
        const domains = DomainManager.getAllDomains();

        for (const d of domains) {
            const edge = this.edgeResults.find(e => e.domainId === d.id);
            html += '<div class="edge-domain-panel product-panel" data-domain-id="' + d.id + '">';
            html += '<div class="panel-header">';
            html += '<h3>' + this.esc(d.name) + '</h3>';
            html += '<label class="checkbox-inline"><input type="checkbox" class="edge-enabled-toggle"' +
                (d.edgeEnabled ? ' checked' : '') + '> Edge cluster déployé</label>';
            html += '</div>';

            if (d.edgeEnabled && edge && edge.enabled) {
                const cfg = d.edgeConfig;
                html += '<div class="panel-body">';

                // Inputs: throughput + HA mode
                html += '<div class="form-row">';
                html += '<div class="form-group"><label>Débit cible (Gbps)</label>' +
                    '<input type="number" class="edge-throughput" min="0" step="0.5" value="' +
                    (cfg.targetThroughput || '') + '" placeholder="Ex: 20"></div>';
                html += '<div class="form-group"><label>Mode HA</label>' +
                    '<select class="edge-ha-mode">' +
                    '<option value="activeStandby"' + (cfg.haMode === 'activeStandby' ? ' selected' : '') + '>Active-Standby</option>' +
                    '<option value="activeActive"' + (cfg.haMode === 'activeActive' ? ' selected' : '') + '>Active-Active (ECMP)</option>' +
                    '</select></div>';
                html += '</div>';

                // Services
                html += '<fieldset class="form-fieldset"><legend>Services activés</legend><div class="checkbox-group">';
                const svcList = [
                    ['statefulFirewall', 'Pare-feu stateful'],
                    ['nat', 'NAT'],
                    ['loadBalancer', 'Load Balancer'],
                    ['vpnIpsec', 'VPN / IPsec'],
                    ['dhcp', 'DHCP Relay'],
                ];
                for (const [key, label] of svcList) {
                    const isVksForced = d.vksEnabled && (key === 'nat' || key === 'loadBalancer');
                    const checked = isVksForced || cfg.services[key] ? ' checked' : '';
                    const disabled = isVksForced ? ' disabled' : '';
                    html += '<label><input type="checkbox" class="edge-svc" data-service="' + key + '"' +
                        checked + disabled + '> ' + label +
                        (isVksForced ? ' <span class="hint">(requis par VKS)</span>' : '') + '</label>';
                }
                html += '</div></fieldset>';

                // Gateways
                html += '<div class="form-row">';
                html += '<div class="form-group"><label>Tier-0 Gateways</label>' +
                    '<input type="number" class="edge-tier0" min="1" max="4" value="' + cfg.tier0Count + '"></div>';
                html += '<div class="form-group"><label>Tier-1 Gateways (manuels)</label>' +
                    '<input type="number" class="edge-tier1" min="0" max="256" value="' + cfg.tier1Count + '">' +
                    '<span class="hint">Hors VKS (calculé automatiquement)</span></div>';
                html += '</div>';

                // Recommendation + Override
                html += '<div class="recommendation-row">';
                if (edge.recommendation) {
                    html += '<span class="rec-badge">Recommandé : ' + edge.recommendation.size +
                        ' \u2014 ' + edge.recommendation.nodeCount + ' nœuds (' +
                        (edge.recommendation.haMode === 'activeActive' ? 'ECMP' : 'Active-Standby') + ')</span>';
                } else {
                    html += '<span class="rec-badge">Spécifiez un débit cible pour obtenir une recommandation</span>';
                }
                html += '<div class="form-row">';
                html += '<div class="form-group"><label>Taille (override)</label><select class="edge-size-override">';
                html += '<option value="">Auto</option>';
                for (const s of SIZING_RULES.nsxEdge.sizeOrder) {
                    const spec = SIZING_RULES.nsxEdge.sizes[s];
                    html += '<option value="' + s + '"' + (cfg.sizeOverride === s ? ' selected' : '') + '>' +
                        spec.label + ' \u2014 ' + spec.vcpu + ' vCPU / ' + spec.ram + ' GB</option>';
                }
                html += '</select></div>';
                html += '<div class="form-group"><label>Nœuds (override)</label><select class="edge-node-override">';
                html += '<option value="">Auto</option>';
                for (let i = 2; i <= 8; i++) {
                    html += '<option value="' + i + '"' + (cfg.nodeCountOverride === i ? ' selected' : '') + '>' + i + '</option>';
                }
                html += '</select></div>';
                html += '</div></div>';

                // Edge results
                html += this.renderEdgeResults(edge);
                html += '</div>'; // panel-body
            }

            html += '</div>'; // edge-domain-panel
        }

        return html;
    },

    renderEdgeResults(edge) {
        const t = edge.throughput;
        let html = '<div class="edge-results">';

        // Throughput summary
        html += '<h4>Analyse du débit</h4>';
        html += '<div class="throughput-summary">';
        html += this.throughputMetric(t.baselinePerNodeGbps + ' Gbps', 'Baseline / nœud');
        html += this.throughputMetric(t.effectivePerNodeGbps + ' Gbps', 'Effectif / nœud');
        html += this.throughputMetric(t.effectiveClusterGbps + ' Gbps', 'Effectif cluster');
        html += this.throughputMetric(t.activeNodes + ' / ' + edge.nodeCount, 'Nœuds actifs');
        html += '</div>';

        // Throughput bar
        const pct = t.worstFactor * 100;
        html += '<div class="throughput-bar-container">';
        html += '<div class="throughput-bar-label"><span>Débit effectif par nœud</span><span>' +
            t.effectivePerNodeGbps + ' / ' + t.baselinePerNodeGbps + ' Gbps (' + Math.round(pct) + '%)</span></div>';
        html += '<div class="throughput-bar"><div class="throughput-bar-fill" style="width:' + pct + '%"></div></div>';
        html += '</div>';

        // Degradation table
        if (t.breakdown.length > 0) {
            html += '<table class="degradation-table"><thead><tr><th>Service</th><th>Facteur</th><th>Débit résultant</th></tr></thead><tbody>';
            for (const row of t.breakdown) {
                html += '<tr class="' + (row.factor === t.worstFactor ? 'worst' : '') + '">' +
                    '<td>' + row.label + '</td><td>x' + row.factor.toFixed(2) + '</td><td>' + row.resultGbps + ' Gbps</td></tr>';
            }
            html += '</tbody></table>';
        }

        // Gateway topology
        const gw = edge.gateways;
        const lim = edge.limits;
        html += '<h4>Topologie des Gateways</h4><div class="gateway-grid">';
        html += this.gatewayItem('Tier-0', gw.tier0Count);
        html += this.gatewayItem('Tier-1 (total)', gw.tier1Total, lim.tier1);
        if (gw.tier1FromVks > 0) html += this.gatewayItem('Tier-1 (VKS)', gw.tier1FromVks);
        html += this.gatewayItem('LB Virtual Servers', gw.totalLbVirtualServers, lim.lbVirtualServers);
        html += this.gatewayItem('Règles SNAT', gw.totalSnatRules, lim.natRules);
        html += '</div>';

        // Resources
        html += '<h4>Ressources</h4>';
        html += '<div class="component-card"><h3>NSX Edge (' + edge.size + ') x' + edge.nodeCount + '</h3>';
        html += '<div class="specs">';
        html += this.specItem(edge.resources.vcpu, 'vCPU');
        html += this.specItem(edge.resources.ram + ' GB', 'RAM');
        html += this.specItem(edge.resources.disk + ' GB', 'Disque');
        html += '</div></div>';

        html += '</div>';
        return html;
    },

    renderNsxManager() {
        let html = '';
        for (const m of this.nsxMgrResults) {
            const domainNames = m.domains.map(d => d.name).join(' + ');
            html += '<div class="product-panel">';
            html += '<h3>NSX Manager \u2014 ' + this.esc(domainNames) + '</h3>';
            html += '<p class="panel-info">Hôtes gérés : ' + m.totalHosts + ' | Cluster : ' + m.nodeCount + ' nœuds</p>';

            html += '<div class="recommendation-row">';
            html += '<span class="rec-badge">Recommandé : ' + m.recommended +
                ' (max ' + SIZING_RULES.nsxManager.sizes[m.recommended].maxHosts + ' hôtes)</span>';
            html += '<div class="form-group"><label>Override</label>' +
                '<select class="nsx-mgr-override" data-group-id="' + m.groupId + '">';
            html += '<option value="">Auto (' + m.recommended + ')</option>';
            for (const s of SIZING_RULES.nsxManager.sizeOrder) {
                const spec = SIZING_RULES.nsxManager.sizes[s];
                html += '<option value="' + s + '"' + (m.overridden && m.size === s ? ' selected' : '') + '>' +
                    spec.label + ' \u2014 ' + spec.vcpu + ' vCPU / ' + spec.ram + ' GB (max ' + spec.maxHosts + ' hôtes)</option>';
            }
            html += '</select></div></div>';

            html += '<div class="component-card"><h3>NSX Manager (' + m.size + ') x' + m.nodeCount + '</h3><div class="specs">';
            html += this.specItem(m.resources.vcpu, 'vCPU');
            html += this.specItem(m.resources.ram + ' GB', 'RAM');
            html += this.specItem(m.resources.disk + ' GB', 'Disque');
            html += '</div></div>';
            html += '</div>';
        }
        return html;
    },

    renderVcenter() {
        let html = '';
        for (const vc of this.vcenterResults) {
            html += '<div class="product-panel">';
            html += '<h3>vCenter \u2014 ' + this.esc(vc.domainName) + '</h3>';
            html += '<p class="panel-info">Hôtes : ' + vc.hosts + ' | VMs : ' + vc.vms + '</p>';

            const recSpec = SIZING_RULES.vcenter.sizes[vc.recommended];
            html += '<div class="recommendation-row">';
            html += '<span class="rec-badge">Recommandé : ' + vc.recommended +
                ' (max ' + recSpec.maxHosts + ' hôtes / ' + recSpec.maxVms + ' VMs)</span>';
            html += '<div class="form-group"><label>Override</label>' +
                '<select class="vcenter-override" data-domain-id="' + vc.domainId + '">';
            html += '<option value="">Auto (' + vc.recommended + ')</option>';
            for (const s of SIZING_RULES.vcenter.sizeOrder) {
                const spec = SIZING_RULES.vcenter.sizes[s];
                html += '<option value="' + s + '"' + (vc.overridden && vc.size === s ? ' selected' : '') + '>' +
                    spec.label + ' \u2014 ' + spec.vcpu + ' vCPU / ' + spec.ram + ' GB</option>';
            }
            html += '</select></div></div>';

            html += '<div class="component-card"><h3>vCenter (' + vc.size + ')</h3><div class="specs">';
            html += this.specItem(vc.resources.vcpu, 'vCPU');
            html += this.specItem(vc.resources.ram + ' GB', 'RAM');
            html += this.specItem(vc.resources.disk + ' GB', 'Disque');
            html += '</div></div>';
            html += '</div>';
        }
        return html;
    },

    renderVcfOps() {
        const o = this.vcfOpsResult;
        if (!o) return '';
        const overrides = ProductCalculators.overrides.vcfOperations;

        let html = '<div class="product-panel">';
        html += '<h3>VCF Operations (Aria Operations)</h3>';
        html += '<p class="panel-info">Hôtes total : ' + o.totalHosts +
            ' | VMs total : ' + o.totalVms +
            ' | Objets estimés : ' + o.estimatedObjects + '</p>';

        html += '<div class="form-row">';
        html += '<div class="form-group"><label>Override objets estimés</label>' +
            '<input type="number" class="vcfops-objects-override" min="0" value="' +
            (overrides.objectsOverride || '') + '" placeholder="Auto : ' + o.autoEstimate + '"></div>';
        html += '<div class="form-group"><label class="checkbox-inline">' +
            '<input type="checkbox" class="vcfops-ha"' + (overrides.ha ? ' checked' : '') +
            '> Haute disponibilité (2 nœuds)</label></div>';
        html += '</div>';

        const recSpec = SIZING_RULES.vcfOperations.sizes[o.recommended];
        html += '<div class="recommendation-row">';
        html += '<span class="rec-badge">Recommandé : ' + o.recommended +
            ' (max ' + recSpec.maxObjects + ' objets)</span>';
        html += '<div class="form-group"><label>Override</label>' +
            '<select class="vcfops-size-override">';
        html += '<option value="">Auto (' + o.recommended + ')</option>';
        for (const s of SIZING_RULES.vcfOperations.sizeOrder) {
            const spec = SIZING_RULES.vcfOperations.sizes[s];
            html += '<option value="' + s + '"' + (o.overridden && o.size === s ? ' selected' : '') + '>' +
                spec.label + ' \u2014 ' + spec.vcpu + ' vCPU / ' + spec.ram + ' GB</option>';
        }
        html += '</select></div></div>';

        html += '<div class="component-card"><h3>VCF Operations (' + o.size + ')' +
            (o.nodeCount > 1 ? ' x' + o.nodeCount : '') + '</h3><div class="specs">';
        html += this.specItem(o.resources.vcpu, 'vCPU');
        html += this.specItem(o.resources.ram + ' GB', 'RAM');
        html += this.specItem(o.resources.disk + ' GB', 'Disque');
        html += '</div></div>';
        html += '</div>';
        return html;
    },

    renderAria() {
        const o = ProductCalculators.overrides.ariaAutomation;
        const result = this.ariaResult;
        const spec = SIZING_RULES.ariaAutomation.perNode;

        let html = '<div class="product-panel">';
        html += '<h3>Aria Automation</h3>';
        html += '<div class="form-group"><label class="checkbox-inline">' +
            '<input type="checkbox" class="aria-enabled"' + (o.enabled ? ' checked' : '') +
            '> Aria Automation activé</label></div>';

        if (o.enabled && result) {
            html += '<div class="form-group"><label class="checkbox-inline">' +
                '<input type="checkbox" class="aria-cluster"' + (o.cluster ? ' checked' : '') +
                '> Cluster HA (3 nœuds)</label></div>';
            html += '<p class="panel-info">Par nœud : ' + spec.vcpu + ' vCPU / ' + spec.ram + ' GB RAM / ' + spec.disk + ' GB Disque</p>';
            html += '<div class="component-card"><h3>Aria Automation x' + result.nodeCount + '</h3><div class="specs">';
            html += this.specItem(result.resources.vcpu, 'vCPU');
            html += this.specItem(result.resources.ram + ' GB', 'RAM');
            html += this.specItem(result.resources.disk + ' GB', 'Disque');
            html += '</div></div>';
        }

        html += '</div>';
        return html;
    },

    renderSddc() {
        const spec = SIZING_RULES.sddcManager.fixed;
        return '<div class="product-panel">' +
            '<h3>SDDC Manager</h3>' +
            '<p class="panel-info">Le SDDC Manager est toujours déployé avec des ressources fixes :</p>' +
            '<div class="specs inline-specs">' +
            this.specItem(spec.vcpu, 'vCPU') +
            this.specItem(spec.ram + ' GB', 'RAM') +
            this.specItem(spec.disk + ' GB', 'Disque') +
            '</div></div>';
    },

    // ── Helpers ──

    renderRecommendations(recs) {
        const icons = { info: '\u2139', warning: '\u26A0', critical: '\u2715' };
        let html = '';
        for (const r of recs) {
            html += '<div class="recommendation rec-' + r.severity + '">' +
                '<span class="rec-icon">' + icons[r.severity] + '</span>' +
                '<span>' + r.message + '</span></div>';
        }
        return html;
    },

    specItem(value, label) {
        return '<div class="spec-item"><div class="value">' + value + '</div><div class="label">' + label + '</div></div>';
    },

    throughputMetric(value, label) {
        return '<div class="throughput-metric"><div class="value">' + value + '</div><div class="label">' + label + '</div></div>';
    },

    gatewayItem(label, value, limit) {
        const exceeded = limit && limit.exceeded;
        const maxInfo = limit ? ' / ' + limit.max : '';
        return '<div class="gateway-item' + (exceeded ? ' exceeded' : '') + '">' +
            '<div class="value">' + value + maxInfo + '</div>' +
            '<div class="label">' + label + '</div></div>';
    },

    esc(str) {
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());
