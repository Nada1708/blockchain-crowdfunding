# Dossier de préparation du rapport académique Fundora

Le livrable attendu est un rapport de 10 à 15 pages. Ce fichier est une trame et
une checklist de preuves, pas le rapport final ni une preuve d'exécution.

## Proposition de structure et volume

| Section | Volume indicatif | Contenu et sources |
|---|---:|---|
| 1. Contexte et cahier des charges | 1 page | Objectifs, exigences M1–M4, sécurité et livrables du PDF officiel |
| 2. Architecture | 1–2 pages | Diagramme frontend/API/MetaMask/IPFS/contrats ; `README.md`, `frontend/README.md` |
| 3. Smart contracts | 2 pages | Responsabilités, interfaces, rôles et flux ; `contracts/`, `docs/DECISIONS.md` |
| 4. Gouvernance et multisig | 1–2 pages | Snapshot, quorum, majorité, Freeze/Unfreeze/EarlyRelease, 2-sur-3 et seuil 1 ETH ; `docs/SECURITY_MODEL.md` |
| 5. Sécurité | 2 pages | CEI, ReentrancyGuard, AccessControl, Pausable, SIWE, CSRF et IPFS ; modèle de menaces |
| 6. Tests et fuzzing | 1–2 pages | 101 tests, attaques de réentrance, deux fuzzings métier et intégration réelle |
| 7. Audit Slither | 1 page | Méthode, 10 findings, qualification et correction antérieure ; `docs/audit/` |
| 8. Déploiement et démonstration | 1–2 pages | Ignition, adresses, rôles, MetaMask, parcours fonctionnel et captures réelles |
| 9. Limites et conclusion | 1 page | Limites connues, améliorations production et bilan de conformité |

## Fichiers à citer ou annexer

### Architecture et installation

- `README.md`
- `docs/DEMARRAGE_FUNDORA.md`
- `docs/LOCAL_DEPLOYMENT.md`
- `frontend/README.md`
- `frontend/IPFS.md`
- `frontend/SMART_CONTRACTS.md`

### Contrats et déploiement

- `contracts/CFDToken.sol`
- `contracts/Crowdfunding.sol`
- `contracts/CFDGovernance.sol`
- `contracts/MultiSigTreasury.sol`
- `contracts/interfaces/ICFDVotes.sol`
- `contracts/interfaces/ICrowdfunding.sol`
- `ignition/modules/Fundora.ts`
- `scripts/verify-local-deployment.mjs`
- `scripts/export-frontend-abis.mjs`
- `docs/DECISIONS.md`
- `docs/SECURITY_MODEL.md`

### Tests à présenter

- `contracts/CFDGovernance.t.sol` : snapshot, quorum, pause et fuzzing des voix.
- `contracts/MultiSigTreasury.t.sol` : 2-sur-3, anti-rejeu, réentrance et fuzzing.
- `test/Crowdfunding.ts` : campagnes, contribution, retrait, remboursement et
  attaque de réentrance.
- `test/FundoraIntegration.ts` : rôles réels, gouvernance et handoff multisig.
- Tests frontend : état wallet/SIWE et propositions.
- `frontend/server/test/` : nonce, vérification SIWE, sessions, CSRF et rate limits.

### Audit à présenter

- `docs/audit/AUDIT.md` : synthèse, qualification et décisions.
- `docs/audit/slither-report-final-4-contracts.md` : sortie finale exhaustive.
- `docs/audit/slither-report-initial.md` et `slither-report-final.md` : historique
  de la correction `reentrancy-events` de la DAO.

## Résultats vérifiés à reporter

- Hardhat/Solidity/Mocha : 54 tests réussis.
- Frontend : 17 tests réussis.
- API/SIWE : 30 tests réussis.
- Total : 101 tests réussis.
- ESLint : réussi.
- TypeScript et build Vite : réussis, avec avertissement de taille de bundle.
- Slither final : 0 High, 0 Medium, 7 Low qualifiés, 3 Informational qualifiés.
- Dépendances de production : 0 vulnérabilité npm au moment de l'audit final.

Chaque nombre doit être accompagné dans le rapport de la date d'exécution et,
si possible, d'une capture récente. Ne pas réutiliser un résultat historique
comme preuve d'une nouvelle version sans relancer la commande correspondante.

## Informations à collecter pendant la session de preuve

- Date et heure de la démonstration.
- Hash Git exact : `git rev-parse HEAD`.
- Versions : `node --version`, `npm --version`, `npx.cmd hardhat --version`.
- Chain ID et URL RPC locale.
- Identifiant Ignition et quatre adresses publiques déployées.
- Résultat JSON de `node scripts/verify-local-deployment.mjs`.
- Compte public utilisé par scénario, sans clé privée.
- ID de campagne, CID IPFS et hashes des transactions.
- ID, type, snapshot, fin, quorum et résultat de la proposition DAO.
- Solde CFD avant/après contribution et remboursement.
- Captures listées dans `docs/captures/README.md`.
- Sortie récente des tests, lint, build et audit statique.

## Explications indispensables

- Pourquoi 1 ETH produit 1 000 CFD.
- Pourquoi le snapshot est pris au bloc précédent.
- Pourquoi le quorum est 20 % et le vote dure 48 heures.
- Différence entre fonds de campagnes en escrow et trésorerie administrative.
- Seuil documentaire de 1 ETH et politique plus stricte du multisig pour tout montant.
- Pourquoi `refund`, `withdrawFunds` et `execute` utilisent CEI et `nonReentrant`.
- Pourquoi le JWT Pinata reste côté serveur et les variables `VITE_*` sont publiques.
- Fonctionnement SIWE : nonce, domaine/URI/chaîne, signature, session, CSRF et expiration.
- Qualification de chaque finding Slither, sans supprimer les Low/Informational.

## Preuves encore externes au dépôt

- Captures réelles du déploiement et des parcours fonctionnels.
- Adresses et hashes issus de la session finale retenue.
- Captures MetaMask 31337 sans secret.
- Date, membres du groupe, encadrant et établissement.
- PDF final de 10 à 15 pages et éventuelles annexes.
- Si Sepolia est utilisé en complément : chain ID, explorer, adresses et liens
  publics. Ne pas prétendre à un déploiement Sepolia si seule la chaîne locale a
  été utilisée.
