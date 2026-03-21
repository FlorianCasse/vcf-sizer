document.getElementById('calculate-btn').addEventListener('click', calculate);

function calculate() {
    const edgeSize = document.getElementById('nsx-edge-size').value;
    const edgeCount = parseInt(document.getElementById('nsx-edge-count').value, 10);
    const nsxManagerSize = document.getElementById('nsx-manager-size').value;
    const opsSize = document.getElementById('vcf-operations').value;
    const vcenterSize = document.getElementById('vcenter-size').value;

    const components = [];
    let totalVcpu = 0;
    let totalRam = 0;
    let totalDisk = 0;

    // NSX Edge Nodes
    const edge = SIZING_DATA.nsxEdge.sizes[edgeSize];
    components.push({
        label: `${SIZING_DATA.nsxEdge.label} (${edgeSize}) x${edgeCount}`,
        vcpu: edge.vcpu * edgeCount,
        ram: edge.ram * edgeCount,
        disk: edge.disk * edgeCount,
    });

    // NSX Manager (3-node cluster)
    const mgr = SIZING_DATA.nsxManager.sizes[nsxManagerSize];
    const mgrCount = SIZING_DATA.nsxManager.count;
    components.push({
        label: `${SIZING_DATA.nsxManager.label} (${nsxManagerSize}) x${mgrCount}`,
        vcpu: mgr.vcpu * mgrCount,
        ram: mgr.ram * mgrCount,
        disk: mgr.disk * mgrCount,
    });

    // VCF Operations
    if (opsSize !== 'none') {
        const ops = SIZING_DATA.vcfOperations.sizes[opsSize];
        components.push({
            label: `${SIZING_DATA.vcfOperations.label} (${opsSize})`,
            vcpu: ops.vcpu,
            ram: ops.ram,
            disk: ops.disk,
        });
    }

    // SDDC Manager
    const sddc = SIZING_DATA.sddcManager.fixed;
    components.push({
        label: SIZING_DATA.sddcManager.label,
        vcpu: sddc.vcpu,
        ram: sddc.ram,
        disk: sddc.disk,
    });

    // vCenter Server
    const vc = SIZING_DATA.vcenter.sizes[vcenterSize];
    components.push({
        label: `${SIZING_DATA.vcenter.label} (${vcenterSize})`,
        vcpu: vc.vcpu,
        ram: vc.ram,
        disk: vc.disk,
    });

    // Build results HTML
    let html = '';
    for (const c of components) {
        totalVcpu += c.vcpu;
        totalRam += c.ram;
        totalDisk += c.disk;

        html += `
        <div class="component-card">
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

    document.getElementById('results-content').innerHTML = html;

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

    document.getElementById('results').classList.remove('hidden');
}
