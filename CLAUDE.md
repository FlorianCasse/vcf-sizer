# CLAUDE.md

## Project Overview
VCF Sizer — outil de sizing pour VMware Cloud Foundation.
Calcule les ressources (CPU, RAM, disque) nécessaires pour les composants VCF :
NSX Edges, NSX Manager, VCF Operations, SDDC Manager, vCenter Server, Aria Suite.

## Tech Stack
- HTML / CSS / JavaScript (vanilla, no build step)
- Hosted on GitHub Pages (auto-deploy via GitHub Actions on push to main)
- Sizing data lives in js/sizing-data.js, UI logic in js/app.js

## Conventions
- Code and variable names in English
- UI labels and user-facing text in French
- No build tools — static files served directly
