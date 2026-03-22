/**
 * Domain Manager — CRUD for workload domains + observer pattern.
 * Central state for the environment definition.
 */

const DomainManager = {
    domains: [],
    listeners: [],
    _nextId: 1,

    init() {
        this.domains = [{
            id: 'mgmt',
            name: 'Management Domain',
            type: 'management',
            hosts: 4,
            vms: 0,
            vksEnabled: false,
            vksClusters: 1,
            vksNamespaces: 5,
            nsxManagerSharing: 'dedicated',
            edgeEnabled: false,
            edgeConfig: this._defaultEdgeConfig(),
        }];
        this._nextId = 1;
    },

    _defaultEdgeConfig() {
        return {
            targetThroughput: 0,
            services: {
                statefulFirewall: false,
                nat: false,
                loadBalancer: false,
                vpnIpsec: false,
                dhcp: false,
            },
            haMode: 'activeStandby',
            tier0Count: 1,
            tier1Count: 1,
            sizeOverride: null,
            nodeCountOverride: null,
        };
    },

    addWorkloadDomain(name) {
        const id = 'wd-' + this._nextId++;
        this.domains.push({
            id,
            name: name || 'Workload Domain ' + this._nextId,
            type: 'vi-workload',
            hosts: 4,
            vms: 100,
            vksEnabled: false,
            vksClusters: 1,
            vksNamespaces: 5,
            nsxManagerSharing: 'dedicated',
            edgeEnabled: true,
            edgeConfig: this._defaultEdgeConfig(),
        });
        this.notify(true);
        return id;
    },

    removeDomain(id) {
        if (id === 'mgmt') return;
        this.domains = this.domains.filter(d => d.id !== id);
        // Fix sharing references pointing to the removed domain
        for (const d of this.domains) {
            if (d.nsxManagerSharing === id) d.nsxManagerSharing = 'dedicated';
        }
        this.notify(true);
    },

    updateDomain(id, changes) {
        const domain = this.domains.find(d => d.id === id);
        if (!domain) return;

        for (const [key, value] of Object.entries(changes)) {
            if (key === 'edgeConfig' && typeof value === 'object') {
                Object.assign(domain.edgeConfig, value);
            } else if (key === 'services' && typeof value === 'object') {
                Object.assign(domain.edgeConfig.services, value);
            } else {
                domain[key] = value;
            }
        }
        this.notify(false);
    },

    getDomain(id) {
        return this.domains.find(d => d.id === id);
    },

    getManagement() {
        return this.domains.find(d => d.type === 'management');
    },

    getWorkloadDomains() {
        return this.domains.filter(d => d.type === 'vi-workload');
    },

    getAllDomains() {
        return [...this.domains];
    },

    getTotalHosts() {
        return this.domains.reduce((s, d) => s + (d.hosts || 0), 0);
    },

    getTotalVms() {
        return this.domains.reduce((s, d) => s + (d.vms || 0), 0);
    },

    /**
     * Group domains by NSX Manager instance.
     * Domains sharing the same NSX Manager are grouped together.
     */
    getNsxManagerGroups() {
        const groups = [];
        const processed = new Set();

        for (const domain of this.domains) {
            if (processed.has(domain.id)) continue;
            if (domain.nsxManagerSharing !== 'dedicated' && domain.type !== 'management') continue;

            const shared = this.domains.filter(
                d => d.id !== domain.id && d.nsxManagerSharing === domain.id
            );
            const all = [domain, ...shared];

            groups.push({
                id: domain.id,
                domains: all,
                totalHosts: all.reduce((s, d) => s + (d.hosts || 0), 0),
                isManagement: domain.type === 'management',
            });

            for (const d of all) processed.add(d.id);
        }

        return groups;
    },

    /**
     * Return domains that can be NSX Manager sharing targets for a given domain.
     */
    getSharingTargets(excludeId) {
        return this.domains.filter(d =>
            d.id !== excludeId &&
            (d.type === 'management' || d.nsxManagerSharing === 'dedicated')
        );
    },

    subscribe(fn) {
        this.listeners.push(fn);
    },

    notify(structureChanged) {
        for (const fn of this.listeners) fn(structureChanged);
    },
};
