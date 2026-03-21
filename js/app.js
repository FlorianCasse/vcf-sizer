// ── Tab navigation ──
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
});

// ── VKS toggle ──
document.getElementById('vks-enabled').addEventListener('change', function () {
    document.getElementById('vks-details').classList.toggle('hidden', !this.checked);
    if (this.checked) {
        document.getElementById('svc-nat').checked = true;
        document.getElementById('svc-lb').checked = true;
    }
});

// ── Calculate ──
document.getElementById('calculate-btn').addEventListener('click', calculate);

function readInputs() {
    const vksEnabled = document.getElementById('vks-enabled').checked;
    return {
        edgeSize: document.getElementById('nsx-edge-size').value,
        edgeCount: parseInt(document.getElementById('nsx-edge-count').value, 10),
        haMode: document.getElementById('nsx-ha-mode').value,
        services: {
            statefulFirewall: document.getElementById('svc-firewall').checked,
            nat: document.getElementById('svc-nat').checked,
            loadBalancer: document.getElementById('svc-lb').checked,
            vpnIpsec: document.getElementById('svc-vpn').checked,
            dhcp: document.getElementById('svc-dhcp').checked,
        },
        tier0Count: parseInt(document.getElementById('tier0-count').value, 10),
        tier1Count: parseInt(document.getElementById('tier1-count').value, 10),
        vksEnabled,
        vksClusters: vksEnabled ? parseInt(document.getElementById('vks-clusters').value, 10) : 0,
        vksNamespacesIngress: vksEnabled ? parseInt(document.getElementById('vks-namespaces-ingress').value, 10) : 0,
        targetThroughput: parseFloat(document.getElementById('target-throughput').value) || 0,
        nsxManagerSize: document.getElementById('nsx-manager-size').value,
        vcenterSize: document.getElementById('vcenter-size').value,
        vcenterCount: parseInt(document.getElementById('vcenter-count').value, 10) || 1,
        opsSize: document.getElementById('vcf-operations').value,
    };
}

function calculate() {
    const inputs = readInputs();

    // Auto-enable services for VKS
    const services = NsxEdgeCalculator.autoEnableServices(inputs.services, inputs.vksEnabled);
    if (inputs.vksEnabled) {
        document.getElementById('svc-nat').checked = true;
        document.getElementById('svc-lb').checked = true;
    }

    // NSX Edge calculations
    const throughput = NsxEdgeCalculator.calculateThroughput(
        inputs.edgeSize, inputs.edgeCount, inputs.haMode, services
    );
    const gateways = NsxEdgeCalculator.calculateGatewayTopology(
        inputs.tier0Count, inputs.tier1Count,
        inputs.vksEnabled, inputs.vksClusters, inputs.vksNamespacesIngress
    );
    const edgeResources = NsxEdgeCalculator.calculateResources(inputs.edgeSize, inputs.edgeCount);
    const limits = NsxEdgeCalculator.checkLimits(inputs.edgeSize, gateways);

    // Recommendations
    const recommendations = RecommendationsEngine.evaluate(
        { ...inputs, services }, throughput, gateways, limits
    );

    // Build all component resources
    const components = [];

    // NSX Edge
    components.push({
        label: `NSX Edge Node (${inputs.edgeSize}) x${inputs.edgeCount}`,
        vcpu: edgeResources.vcpu,
        ram: edgeResources.ram,
        disk: edgeResources.disk,
    });

    // NSX Manager (always 3 nodes)
    const mgr = SIZING_DATA.nsxManager.sizes[inputs.nsxManagerSize];
    const mgrCount = SIZING_DATA.nsxManager.count;
    components.push({
        label: `NSX Manager (${inputs.nsxManagerSize}) x${mgrCount}`,
        vcpu: mgr.vcpu * mgrCount,
        ram: mgr.ram * mgrCount,
        disk: mgr.disk * mgrCount,
    });

    // vCenter Server
    const vc = SIZING_DATA.vcenter.sizes[inputs.vcenterSize];
    components.push({
        label: `vCenter Server (${inputs.vcenterSize}) x${inputs.vcenterCount}`,
        vcpu: vc.vcpu * inputs.vcenterCount,
        ram: vc.ram * inputs.vcenterCount,
        disk: vc.disk * inputs.vcenterCount,
    });

    // VCF Operations
    if (inputs.opsSize !== 'none') {
        const ops = SIZING_DATA.vcfOperations.sizes[inputs.opsSize];
        components.push({
            label: `VCF Operations (${inputs.opsSize})`,
            vcpu: ops.vcpu,
            ram: ops.ram,
            disk: ops.disk,
        });
    }

    // SDDC Manager
    const sddc = SIZING_DATA.sddcManager.fixed;
    components.push({
        label: "SDDC Manager",
        vcpu: sddc.vcpu,
        ram: sddc.ram,
        disk: sddc.disk,
    });

    // Render everything
    renderThroughput(throughput, inputs);
    renderGateways(gateways, limits);
    renderResources(components);
    renderRecommendations(recommendations);
    renderTotals(components);

    document.getElementById('results').classList.remove('hidden');
}

// ── Renderers ──

function renderThroughput(t, inputs) {
    const pct = t.worstFactor * 100;
    let html = `<h3>Analyse du débit NSX Edge</h3>`;

    html += `<div class="throughput-summary">
        <div class="throughput-metric">
            <div class="value">${t.baselinePerNodeGbps} Gbps</div>
            <div class="label">Baseline / nœud</div>
        </div>
        <div class="throughput-metric">
            <div class="value">${t.effectivePerNodeGbps} Gbps</div>
            <div class="label">Effectif / nœud</div>
        </div>
        <div class="throughput-metric">
            <div class="value">${t.effectiveClusterGbps} Gbps</div>
            <div class="label">Effectif cluster</div>
        </div>
        <div class="throughput-metric">
            <div class="value">${t.activeNodes} / ${inputs.edgeCount}</div>
            <div class="label">Nœuds actifs</div>
        </div>
    </div>`;

    // Throughput bar
    html += `<div class="throughput-bar-container">
        <div class="throughput-bar-label">
            <span>Débit effectif par nœud</span>
            <span>${t.effectivePerNodeGbps} / ${t.baselinePerNodeGbps} Gbps (${Math.round(pct)}%)</span>
        </div>
        <div class="throughput-bar">
            <div class="throughput-bar-fill" style="width: ${pct}%"></div>
        </div>
    </div>`;

    // Degradation table
    if (t.breakdown.length > 0) {
        html += `<table class="degradation-table">
            <thead><tr>
                <th>Service</th>
                <th>Facteur</th>
                <th>Débit résultant</th>
            </tr></thead><tbody>`;
        for (const row of t.breakdown) {
            const isWorst = row.factor === t.worstFactor;
            html += `<tr class="${isWorst ? 'worst' : ''}">
                <td>${row.label}</td>
                <td>x${row.factor.toFixed(2)}</td>
                <td>${row.resultGbps} Gbps</td>
            </tr>`;
        }
        html += `</tbody></table>`;
    }

    document.getElementById('results-throughput').innerHTML = html;
}

function renderGateways(gw, limits) {
    let html = `<h3>Topologie des Gateways</h3><div class="gateway-grid">`;

    html += gatewayItem("Tier-0", gw.tier0Count);
    html += gatewayItem("Tier-1 (total)", gw.tier1Total, limits.tier1);
    if (gw.tier1FromVks > 0) {
        html += gatewayItem("Tier-1 (VKS)", gw.tier1FromVks);
    }
    html += gatewayItem("LB Virtual Servers", gw.totalLbVirtualServers, limits.lbVirtualServers);
    html += gatewayItem("Règles SNAT", gw.totalSnatRules, limits.natRules);

    html += `</div>`;
    document.getElementById('results-gateways').innerHTML = html;
}

function gatewayItem(label, value, limit) {
    const exceeded = limit && limit.exceeded;
    const maxInfo = limit ? ` / ${limit.max}` : '';
    return `<div class="gateway-item ${exceeded ? 'exceeded' : ''}">
        <div class="value">${value}${maxInfo}</div>
        <div class="label">${label}</div>
    </div>`;
}

function renderResources(components) {
    let html = '';
    for (const c of components) {
        html += `<div class="component-card">
            <h3>${c.label}</h3>
            <div class="specs">
                <div class="spec-item">
                    <div class="value">${c.vcpu}</div>
                    <div class="label">vCPU</div>
                </div>
                <div class="spec-item">
                    <div class="value">${c.ram} GB</div>
                    <div class="label">RAM</div>
                </div>
                <div class="spec-item">
                    <div class="value">${c.disk} GB</div>
                    <div class="label">Disque</div>
                </div>
            </div>
        </div>`;
    }
    document.getElementById('results-resources').innerHTML = html;
}

function renderRecommendations(recs) {
    if (recs.length === 0) {
        document.getElementById('results-recommendations').innerHTML = '';
        return;
    }

    const icons = { info: 'i', warning: '!', critical: 'X' };
    let html = '';
    for (const r of recs) {
        html += `<div class="recommendation rec-${r.severity}">
            <span class="rec-icon">${icons[r.severity]}</span>
            <span>${r.message}</span>
        </div>`;
    }
    document.getElementById('results-recommendations').innerHTML = html;
}

function renderTotals(components) {
    let totalVcpu = 0, totalRam = 0, totalDisk = 0;
    for (const c of components) {
        totalVcpu += c.vcpu;
        totalRam += c.ram;
        totalDisk += c.disk;
    }

    document.getElementById('totals').innerHTML = `
        <h3>Total des ressources management</h3>
        <div class="specs">
            <div class="spec-item">
                <div class="value">${totalVcpu}</div>
                <div class="label">vCPU</div>
            </div>
            <div class="spec-item">
                <div class="value">${totalRam} GB</div>
                <div class="label">RAM</div>
            </div>
            <div class="spec-item">
                <div class="value">${totalDisk} GB</div>
                <div class="label">Disque</div>
            </div>
        </div>`;
}
