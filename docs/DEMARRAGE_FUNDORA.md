# Fundora — Guide de démarrage sur Windows

> **Périmètre :** démonstration académique locale. Chaque ordinateur exécute sa
> propre blockchain Hardhat et possède ses propres adresses de contrats, comptes
> de test et fichiers `.env`. Ceci n'est pas un déploiement public.

## 1. Prérequis

- Windows 11 avec PowerShell, Git, Node.js 24 et npm.
- Chrome, ou un navigateur compatible, avec l'extension MetaMask officielle.
- Un compte Pinata et un JWT restreint pour l'upload IPFS des campagnes.
- Une connexion Internet pour installer les dépendances et utiliser Pinata.

## 2. Première installation sur un autre PC

Dans PowerShell :

```powershell
git clone https://github.com/Nada1708/blockchain-crowdfunding.git
Set-Location blockchain-crowdfunding
git switch main
npm.cmd ci
npm.cmd --prefix frontend ci
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item frontend/server/.env.example frontend/server/.env
```

Configurer les fichiers locaux, qui ne sont pas suivis par Git :

- Dans `frontend/server/.env`, renseigner la variable `PINATA_JWT` avec son
  propre JWT Pinata restreint. Ne jamais partager ou committer cette valeur.
- Dans `frontend/.env.local`, après le déploiement, remplacer les trois adresses
  fictives `VITE_HARDHAT_CFD_TOKEN_ADDRESS`,
  `VITE_HARDHAT_CROWDFUNDING_ADDRESS` et
  `VITE_HARDHAT_CFD_GOVERNANCE_ADDRESS` par les adresses publiques retournées
  par Ignition. Conserver `VITE_SIWE_CHAIN_ID=31337`.
- Ne jamais placer de secret dans une variable `VITE_*` : elle est visible dans
  le navigateur.

## 3. Lancer les services

Exécuter les commandes depuis la racine du dépôt.

### Terminal A — blockchain Hardhat

Garder ce terminal ouvert :

```powershell
npx.cmd hardhat node --hostname 127.0.0.1 --port 8545
```

### Terminal B — déploiement, puis API Express

Déployer les quatre contrats et vérifier le déploiement :

```powershell
npx.cmd hardhat ignition deploy ignition/modules/Fundora.ts --network localhost --deployment-id fundora-local
node scripts/verify-local-deployment.mjs
```

Reporter les trois adresses utilisées par le frontend dans
`frontend/.env.local`. Les ABI finales sont versionnées. Si les contrats ont
changé, les régénérer avec :

```powershell
node scripts/export-frontend-abis.mjs
```

Si le nœud Hardhat a été fermé, le nouveau nœud est vierge. Si le journal
Ignition `fundora-local` référence encore l'ancien nœud, redéployer avec
`--reset`. Cette option réinitialise le journal Ignition ciblé : ne pas
l'utiliser sur une session locale contenant des campagnes à préserver.

Après le déploiement, démarrer l'API Express SIWE/IPFS et garder le terminal
ouvert :

```powershell
npm.cmd --prefix frontend run server
```

### Terminal C — frontend React/Vite

```powershell
npm.cmd --prefix frontend run dev
```

Ouvrir <http://localhost:5173>. Vérifier le proxy et l'API avec
<http://localhost:5173/api/health> : la réponse doit indiquer `status: ok`.
Vite utilise volontairement le port strict `5173`, Express le port `8787` et
Hardhat le port RPC `8545`.

## 4. Configurer MetaMask

1. Installer l'extension officielle MetaMask.
2. Utiliser uniquement un wallet de développement, sans fonds réels.
3. Ajouter le réseau personnalisé :
   - Nom : `Fundora Hardhat Local`
   - RPC : `http://127.0.0.1:8545`
   - Chain ID : `31337`
   - Symbole : `ETH`
4. Utiliser un compte Hardhat préfinancé affiché au lancement du nœud, ou lui
   faire transférer de l'ETH de test vers un autre wallet local. Les clés
   Hardhat sont publiques : ne jamais les réutiliser sur un vrai réseau.
5. Dans Fundora : **Connect Wallet** → choisir le compte →
   **Sign In with Ethereum** → signer le message SIWE → Home.
6. L'icône de profil ouvre Account pour Sign Out. Les campagnes restent
   consultables publiquement sans connexion.

Sur chaque PC, `localhost` désigne ce PC. Pour une démonstration indépendante,
chaque membre doit lancer Hardhat, Express et Vite localement et utiliser les
adresses de son propre déploiement.

## 5. Vérifier avant la démonstration

Depuis la racine :

```powershell
npx.cmd hardhat test
npm.cmd --prefix frontend run test:frontend
npm.cmd --prefix frontend run test:api
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```

Un avertissement Vite concernant un chunk supérieur à 500 kB n'empêche pas le
build.

## 6. Points importants

- Une blockchain Hardhat fraîche contient zéro campagne et zéro proposition.
- Les sessions SIWE en mémoire sont perdues au redémarrage d'Express.
- Les uploads IPFS exigent un JWT Pinata valide dans le fichier serveur local.
- Le multisig 2-sur-3 est déployé et testé ; les rôles administrateur et pauser
  restent attribués au déployeur local.
- Fundora est un prototype académique, pas un déploiement de production.

## 7. Dépannage rapide

| Symptôme | Vérification ou action |
|---|---|
| `ECONNREFUSED 127.0.0.1:8545` | Démarrer le nœud Hardhat. |
| Contrat absent à l'adresse configurée | Redéployer sur le nœud courant et mettre à jour `.env.local`. |
| `Authentication is unavailable` | Démarrer Express sur `8787`, puis tester `/api/health` via Vite. |
| Port `5173` occupé | Fermer proprement l'ancien Vite ou réutiliser son onglet. |
| MetaMask sur le mauvais réseau | Sélectionner Fundora Hardhat Local (`31337`). |
| ETH insuffisant | Utiliser uniquement l'ETH de test Hardhat. |
| Upload IPFS impossible | Vérifier Internet, le JWT Pinata serveur et ses permissions. |
