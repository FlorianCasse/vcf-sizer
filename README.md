# VCF Sizer

Outil de sizing pour VMware Cloud Foundation (VCF).

## Fonctionnalités

Calcul des ressources nécessaires pour les composants VCF :

- **NSX Edges** — Sizing des Edge Nodes (Small, Medium, Large, Extra Large)
- **NSX Manager** — Cluster NSX Manager (ressources CPU, RAM, disque)
- **VCF Operations** — VMware Aria Operations (anciennement vRealize Operations)
- **SDDC Manager** — Ressources pour le gestionnaire SDDC
- **vCenter Server** — Sizing des vCenter Server Appliances
- **Aria Suite** — Aria Automation, Aria Operations for Logs, Aria Operations for Networks

## Stack technique

- Python 3.12+
- Framework web : à définir

## Démarrage rapide

```bash
# Cloner le repo
git clone https://github.com/FlorianCasse/vcf-sizer.git
cd vcf-sizer

# Créer un environnement virtuel
python3 -m venv .venv
source .venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

## Licence

MIT
