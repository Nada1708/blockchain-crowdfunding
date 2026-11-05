# Décisions du projet Fundora

> Statut : état final implémenté sur la branche `main`. Ce document décrit le
> code actuel ; aucun point ci-dessous n'est une promesse de fonctionnalité future.

## 1. Jeton CFD (`CFDToken.sol`)

- Nom : Crowdfunding Token ; symbole : CFD ; 18 décimales.
- Standards OpenZeppelin : ERC-20, ERC20Permit, ERC20Votes et AccessControl.
- Aucune offre initiale : les CFD sont frappés lors des contributions.
- `mint` et `burn` sont réservés aux rôles `MINTER_ROLE` et `BURNER_ROLE`, tous
  deux accordés uniquement à `Crowdfunding` par le module Ignition.
- Auto-délégation au premier mint ; une redélégation ultérieure reste possible.
- Les snapshots `getPastVotes` et `getPastTotalSupply` protègent la gouvernance
  contre l'acquisition temporaire de jetons après la création d'une proposition.

## 2. Conversion ETH vers CFD

- Taux : 1 ETH = 1 000 CFD (`RATE = 1000`).
- Le calcul s'effectue en wei, sans nombres flottants.
- Justification : un apport de 0,1 ETH produit 100 CFD, soit le seuil de
  proposition de gel/dégel ; la contribution minimale de 0,01 ETH produit 10 CFD.

## 3. Campagnes et métadonnées

- Création ouverte à tous : `createCampaign(beneficiary, goal, duration, cid)`.
- Objectif strictement positif, bénéficiaire non nul et durée de 1 seconde à
  365 jours.
- Les métadonnées et l'image sont déposées sur IPFS via le proxy Pinata ; seul
  le CID des métadonnées est stocké on-chain.
- Contribution minimale : 0,01 ETH ; aucun maximum contractuel.
- Statuts : Active, Successful, Failed et Cancelled.
- Le créateur peut annuler avant tout retrait. L'annulation rend les
  contributeurs éligibles au remboursement.

## 4. Remboursement

- `refund(id)` est permis si la campagne est échouée, gelée ou annulée.
- Le montant est calculé au prorata des fonds restants :
  `paid * (raised - withdrawn) / raised`.
- Checks-Effects-Interactions : contribution remise à zéro avant le burn et
  l'envoi d'ETH ; `nonReentrant` bloque la réentrance.
- Les CFD correspondant à la contribution sont brûlés. Un contributeur qui les
  a transférés doit les récupérer avant de pouvoir être remboursé.

## 5. Autorisation et retrait des fonds de campagne

- Les ETH détenus par `Crowdfunding` constituent un escrow de campagne, pas la
  trésorerie administrative de Fundora.
- Une proposition DAO `EarlyRelease` ne peut être créée que par le bénéficiaire.
- Après vote réussi, `approveEarlyRelease(id, amount)` augmente le montant
  autorisé sans pouvoir dépasser le total levé.
- `withdrawFunds(id)` est réservé au bénéficiaire et retire
  `approved - withdrawn`. Il est interdit si la campagne est gelée, annulée ou
  si le contrat est en pause.
- Double retrait impossible ; fonction protégée par `nonReentrant`.

## 6. Gouvernance DAO

- Propositions : Freeze, Unfreeze et EarlyRelease.
- Durée : 48 heures ; quorum : 20 % de l'offre CFD au snapshot ; majorité :
  strictement plus de voix pour que contre.
- Snapshot : bloc précédant la création de la proposition (`clock() - 1`).
- Seuil Freeze/Unfreeze : 100 CFD au snapshot. EarlyRelease exige que le
  proposant soit le bénéficiaire et n'impose pas ce seuil.
- Une adresse ne vote qu'une fois par proposition. L'exécution n'est possible
  qu'après la fin du vote et une seule fois.
- `CFDGovernance` possède seul le `GOVERNANCE_ROLE` de `Crowdfunding`.

## 7. Pause et contrôle d'accès

- `Crowdfunding` et `CFDGovernance` héritent de `Pausable`.
- La pause de `Crowdfunding` suspend contributions, remboursements et retraits.
- La pause de la DAO bloque les nouvelles propositions et leur exécution ; les
  votes déjà ouverts restent possibles pour ne pas perdre la période de vote.
- Les rôles admin et pauser sont transférés à `MultiSigTreasury` ; les rôles de
  bootstrap du déployeur sont révoqués après configuration.

## 8. Trésorerie multisignature et seuil documentaire

- `MultiSigTreasury` possède trois signataires distincts et exige deux
  confirmations pour exécuter une opération.
- **Seuil documentaire de trésorerie : 1 ETH.** Il représente 100 fois la
  contribution minimale et qualifie une sortie administrative significative.
- Le cahier des charges exige 2-sur-3 au-delà de 1 ETH. Le contrat applique une
  politique plus stricte : toute sortie du coffre, même inférieure ou égale à
  1 ETH, requiert 2-sur-3.
- Le seuil ne s'applique pas aux remboursements ou retraits de campagnes : ces
  fonds restent dans `Crowdfunding` et suivent les règles de l'escrow et de la DAO.
- `test_TwoOfThreeExecutes` couvre une sortie de 3 ETH ;
  `test_RevertWhen_OnlyOneSignature` prouve le refus à une seule signature.

## 9. Sécurité et audit

- AccessControl strict ; aucun usage de `tx.origin`.
- Checks-Effects-Interactions et ReentrancyGuard sur les sorties d'ETH.
- Tests d'attaque par réentrance sur le remboursement et le coffre multisig.
- Fuzzing des snapshots de vote et du contrôle d'accès multisig.
- Audit final Slither des quatre contrats métier :
  [`audit/AUDIT.md`](audit/AUDIT.md) et
  [`audit/slither-report-final-4-contracts.md`](audit/slither-report-final-4-contracts.md).
- Résultat : 0 High, 0 Medium, 7 Low qualifiés et 3 Informational qualifiés.

## 10. Déploiement final

Le module `ignition/modules/Fundora.ts` effectue atomiquement :

1. déploiement de `MultiSigTreasury` avec les trois premiers comptes locaux ;
2. déploiement de `CFDToken`, `Crowdfunding` et `CFDGovernance` ;
3. attribution des rôles minter/burner à `Crowdfunding` ;
4. attribution du rôle de gouvernance à `CFDGovernance` ;
5. transfert des rôles admin/pauser au multisig ;
6. révocation des rôles temporaires du déployeur.

Les adresses locales ne sont pas portables après réinitialisation du nœud.
Aucune clé Hardhat, clé privée, seed phrase ou valeur `.env` ne doit apparaître
dans le dépôt, le rapport ou les captures.
