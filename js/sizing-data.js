/**
 * VCF component sizing specifications.
 * Sources: VMware documentation & VCF sizing guides.
 * Values: vCPU, RAM (GB), Disk (GB)
 */

const SIZING_DATA = {
    nsxEdge: {
        label: "NSX Edge Node",
        sizes: {
            small:  { vcpu: 2,  ram: 4,   disk: 200 },
            medium: { vcpu: 4,  ram: 8,   disk: 200 },
            large:  { vcpu: 8,  ram: 32,  disk: 200 },
            xlarge: { vcpu: 16, ram: 64,  disk: 200 },
        }
    },
    nsxManager: {
        label: "NSX Manager",
        count: 3, // always a 3-node cluster
        sizes: {
            small:  { vcpu: 4,  ram: 16, disk: 300 },
            medium: { vcpu: 6,  ram: 24, disk: 300 },
            large:  { vcpu: 12, ram: 48, disk: 300 },
        }
    },
    vcfOperations: {
        label: "VCF Operations (Aria Operations)",
        sizes: {
            none:   null,
            small:  { vcpu: 4,  ram: 16, disk: 274 },
            medium: { vcpu: 8,  ram: 32, disk: 514 },
            large:  { vcpu: 16, ram: 48, disk: 812 },
        }
    },
    sddcManager: {
        label: "SDDC Manager",
        count: 1,
        fixed: { vcpu: 4, ram: 16, disk: 500 }
    },
    vcenter: {
        label: "vCenter Server",
        sizes: {
            tiny:   { vcpu: 2,  ram: 14,  disk: 579 },
            small:  { vcpu: 4,  ram: 21,  disk: 694 },
            medium: { vcpu: 8,  ram: 30,  disk: 908 },
            large:  { vcpu: 16, ram: 40,  disk: 1358 },
            xlarge: { vcpu: 24, ram: 58,  disk: 2283 },
        }
    },
};
