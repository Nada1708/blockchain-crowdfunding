# Guide de collecte des captures académiques

Ce dossier doit contenir uniquement des captures réelles produites pendant une
session locale contrôlée. Ce guide ne constitue pas une preuve de déploiement et
aucune capture n'a été fabriquée.

## Règles avant la collecte

- Utiliser exclusivement Hardhat local, Chain ID `31337`, sans fonds réels.
- Ne jamais capturer une clé privée, une seed phrase, un JWT Pinata, un cookie,
  un fichier `.env` ou la liste des clés affichée au démarrage de Hardhat.
- Pour le terminal du nœud, cadrer seulement les nouvelles transactions ou la
  ligne RPC ; masquer ou faire défiler la liste initiale des comptes et clés.
- Conserver les hashes de transaction et adresses publiques : ce ne sont pas des
  secrets sur cette chaîne locale.
- Utiliser des noms numérotés : `01-deploiement-ignition.png`, etc.
- Ne modifier aucune image autrement que recadrage et masquage de secrets. Ne
  pas ajouter un résultat qui n'était pas visible lors de la capture.
- Réaliser les opérations transactionnelles ci-dessous uniquement pendant une
  session de preuve dédiée. Les commandes de préparation ne doivent pas être
  relancées contre une session contenant des données à préserver.

## Préparation de la session de preuve

Depuis la racine, ouvrir quatre terminaux.

**Terminal A — nœud local**

```powershell
npx.cmd hardhat node --hostname 127.0.0.1 --port 8545
```

Ne pas capturer les clés affichées. Une fois le nœud prêt, faire défiler le
terminal jusqu'aux appels RPC récents.

**Terminal B — déploiement**

```powershell
npx.cmd hardhat ignition deploy ignition/modules/Fundora.ts --network localhost --deployment-id fundora-local
```

Cette commande déploie réellement les contrats. Ne l'exécuter que pour la
session de collecte, jamais sur un déploiement à préserver.

**Terminal C — API SIWE/IPFS**

```powershell
npm.cmd --prefix frontend run server
```

**Terminal D — frontend**

```powershell
npm.cmd --prefix frontend run dev
```

Avant les captures fonctionnelles, reporter les trois adresses frontend dans
`frontend/.env.local`, connecter un wallet de développement et vérifier que
l'API répond sur `http://localhost:5173/api/health`.

## Captures obligatoires

### 01 — Déploiement Hardhat Ignition

- **Fichier** : `01-deploiement-ignition.png`
- **Action** : exécuter la commande Ignition du terminal B.
- **Cadrage attendu** : nom `FundoraModule`, quatre contrats déployés et statut
  final réussi.
- **Secret à exclure** : aucune clé ou seed du terminal A.

### 02 — Adresses des quatre contrats

- **Fichier** : `02-adresses-contrats.png`
- **Commande de lecture seule** :

```powershell
Get-Content ignition/deployments/fundora-local/deployed_addresses.json
```

- **Cadrage attendu** : adresses publiques de `CFDToken`, `Crowdfunding`,
  `CFDGovernance` et `MultiSigTreasury`, avec l'identifiant de déploiement.
- Recopier ces quatre adresses dans la légende du rapport.

### 03 — Rôles, permissions et révocation du déployeur

- **Fichier** : `03-verification-roles.png`
- **Commande de lecture seule on-chain** :

```powershell
node scripts/verify-local-deployment.mjs
```

- **Cadrage attendu** : `chainId: 31337`, les quatre adresses et tous les
  champs `checks` à `true`, notamment minter/burner, gouvernance, admin/pauser
  multisig, révocations bootstrap, trois signataires et seuil de deux signatures.
- Cette commande ne signe et n'envoie aucune transaction.

### 04 — MetaMask sur Hardhat Local

- **Fichier** : `04-metamask-chain-31337.png`
- **Action exacte** : MetaMask → sélecteur de réseau → `Fundora Hardhat Local`
  → paramètres du réseau.
- **Cadrage attendu** : RPC `http://127.0.0.1:8545`, Chain ID `31337`, symbole
  `ETH`, puis l'en-tête Fundora montrant le wallet connecté.
- Ne jamais ouvrir ni capturer « Show private key » ou la phrase de récupération.

### 05 — Création d'une campagne

- **Fichier** : `05-creation-campagne.png`
- **Action exacte** : ouvrir `http://localhost:5173/create`, saisir un titre,
  une description, un objectif, une durée et l'adresse publique du bénéficiaire ;
  générer l'aperçu, uploader les métadonnées IPFS, puis cliquer sur le bouton de
  création blockchain et confirmer dans MetaMask.
- **Cadrage attendu après confirmation** : ID de campagne, hash de transaction,
  CID IPFS et message de succès.
- Le JWT Pinata doit rester invisible dans `frontend/server/.env`.

### 06 — Contribution et mint CFD

- **Fichier** : `06-contribution-cfd.png`
- **Précondition** : campagne active et compte connecté sur 31337.
- **Action exacte** : ouvrir `/campaigns`, saisir `0.1` ETH dans la campagne
  réelle, cliquer « Contribuer » et confirmer dans MetaMask.
- **Cadrage attendu** : transaction confirmée, progression mise à jour et solde
  ou pouvoir de vote de 100 CFD. Conserver le hash visible.

### 07 — Proposition de gouvernance

- **Fichier** : `07-proposition-freeze.png`
- **Précondition** : le compte ayant contribué 0,1 ETH possède 100 CFD
  auto-délégués.
- **Action exacte** : ouvrir `/governance`, choisir `Freeze`, sélectionner la
  campagne réelle, cliquer « Créer la proposition », vérifier le récapitulatif,
  confirmer dans l'application puis dans MetaMask.
- **Cadrage attendu** : ID, type Freeze, campagne, snapshot, fin du vote et hash.

### 08 — Vote pondéré

- **Fichier** : `08-vote-snapshot.png`
- **Action exacte** : sur la proposition active, cliquer « Pour » et confirmer
  dans MetaMask.
- **Cadrage attendu** : poids de 100 CFD, numéro du snapshot, total des voix et
  hash de vote.

### 09 — Fin du vote et exécution

- **Fichier** : `09-execution-gel.png`
- **Précondition** : vote favorable et quorum atteint.
- **Actions exactes sur la chaîne locale de preuve uniquement** :

```powershell
$rpcBody = '{"jsonrpc":"2.0","method":"evm_increaseTime","params":[172801],"id":1}'
Invoke-RestMethod -Uri http://127.0.0.1:8545 -Method Post -ContentType 'application/json' -Body $rpcBody
$mineBody = '{"jsonrpc":"2.0","method":"evm_mine","params":[],"id":2}'
Invoke-RestMethod -Uri http://127.0.0.1:8545 -Method Post -ContentType 'application/json' -Body $mineBody
```

Ces appels avancent uniquement l'horloge de la chaîne locale ; ils ne signent
pas une transaction. Actualiser `/governance`, cliquer « Exécuter » et confirmer
la transaction MetaMask.

- **Cadrage attendu** : état `Executed`, hash d'exécution et campagne gelée.

### 10 — Remboursement

- **Fichier** : `10-remboursement.png`
- **Précondition** : campagne gelée par la proposition précédente et compte
  contributeur détenant encore les 100 CFD reçus.
- **Action exacte** : ouvrir `/campaigns`, cliquer « Rembourser » sur la
  campagne réelle et confirmer dans MetaMask.
- **Cadrage attendu** : message de remboursement confirmé, hash, contribution
  remise à zéro et diminution/burn des CFD.

## Captures complémentaires recommandées

### 11 — Suite de tests

```powershell
npx.cmd hardhat test
npm.cmd --prefix frontend run test:frontend
npm.cmd --prefix frontend run test:api
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```

Capturer les totaux réussis et l'absence d'erreur, sans prétendre qu'une ancienne
capture représente une exécution plus récente.

### 12 — Audit Slither

Capturer les tableaux de `docs/audit/AUDIT.md` montrant 0 High, 0 Medium,
7 Low et 3 Informational. Le rapport brut de référence est
`docs/audit/slither-report-final-4-contracts.md`.

## Tableau de traçabilité à compléter

| Capture | Date/heure | Chaîne | Adresse ou hash principal | Vérifié par |
|---|---|---|---|---|
| 01 à 12 | À renseigner | 31337 | À renseigner sans secret | Initiales |
