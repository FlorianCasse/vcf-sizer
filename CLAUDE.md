# CLAUDE.md

## Project Overview
VCF Sizer — outil de sizing pour VMware Cloud Foundation.
Calcule les ressources (CPU, RAM, disque) nécessaires pour les composants VCF :
NSX Edges, NSX Manager, VCF Operations, SDDC Manager, vCenter Server, Aria Suite.

## Tech Stack
- HTML / CSS / JavaScript (vanilla, no build step)
- Hosted on GitHub Pages (auto-deploy via GitHub Actions on push to main)

## Architecture JS
| Fichier | Rôle |
|---------|------|
| `js/sizing-rules.js` | Données de sizing + fonctions `recommend()` par produit |
| `js/domain-manager.js` | CRUD des workload domains + pattern observer |
| `js/nsx-edge-calculator.js` | Calcul NSX Edge par domaine (throughput, gateways, limites) |
| `js/product-calculators.js` | Calculateurs NSX Manager, vCenter, VCF Ops, Aria Auto, Summary |
| `js/recommendations.js` | Moteur de recommandations par produit et par domaine |
| `js/app.js` | Rendu DOM, events, tabs, orchestration |

Flux : Input → DomainManager.update() → notify() → recalculate() → renderActiveTab()

## Conventions
- Code and variable names in English
- UI labels and user-facing text in French
- No build tools — static files served directly
