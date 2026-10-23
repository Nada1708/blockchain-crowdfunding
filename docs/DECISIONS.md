# Décisions du projet Blockchain Crowdfunding

> Statut : implémenté dans `contracts/` (branche `feature/token-core`). Les points marqués **[À valider]** concernent aussi la DAO (membre 2).

## 1. Jeton CFD (`CFDToken.sol`)
- Nom : Crowdfunding Token, symbole : CFD, 18 décimales
- Standards : ERC20 + ERC20Permit + ERC20Votes (snapshot via `getPastVotes`) + AccessControl
- Offre initiale : aucune, les CFD sont créés uniquement à la contribution
- `mint` : réservé à `MINTER_ROLE` (donné au contrat Crowdfunding)
- `burn` : réservé à `BURNER_ROLE` (donné au contrat Crowdfunding)
- Compatible avec l'interface `ICFDVotes` de la DAO

## 2. Conversion ETH vers CFD
- Taux : 1 ETH = 1000 CFD (`RATE = 1000`)
- Calcul entier en wei, sans nombres flottants

## 3. Campagnes
- Création : `createCampaign(beneficiary, goal, duration, cid)`, ouverte à tous
- Objectif > 0, bénéficiaire non nul, durée entre 1 seconde et 365 jours
- Métadonnées : CID IPFS stocké dans la campagne
- Contribution minimale : 0,01 ETH, pas de maximum

## 4. Échec et remboursement
- Une campagne échoue si la date limite est passée et l'objectif non atteint
- `refund(id)` : possible si la campagne a échoué **ou** est gelée
- Montant : au prorata de ce qui reste (`raised - withdrawn`)
- Double remboursement impossible (contribution remise à zéro avant l'envoi)
- Les CFD du contributeur sont **brûlés** : il doit les avoir encore, sinon le remboursement échoue

## 5. Réussite et retrait
- Le bénéficiaire ne retire que ce que la DAO a autorisé : `approveEarlyRelease(id, amount)` (montants cumulatifs, jamais au-delà de ce qui a été levé)
- `withdraw(id)` : réservé au bénéficiaire, retire `approved - withdrawn`, impossible si la campagne est gelée
- Double retrait impossible

## 6. Gouvernance
- Rôle `GOVERNANCE_ROLE` donné à l'adresse de la DAO au déploiement (`grantRole`)
- `freezeCampaign(id)` et `approveEarlyRelease(id, amount)` : réservés à ce rôle
- `unfreezeCampaign(id)` : réservé à ce rôle **[À valider]**
- Interface imposée par la DAO : `contracts/interfaces/ICrowdfunding.sol`

## 7. Sécurité
- `ReentrancyGuard` sur `refund` et `withdraw`
- Checks-Effects-Interactions respecté
- Droits d'accès par rôles (AccessControl), aucun `tx.origin`
- Pause d'urgence globale : non implémentée, le gel se fait par campagne **[À valider]**
- Multisignature 2 sur 3 : à mettre sur le compte admin / la DAO **[À valider]**
- Aucun ETH réel : développement local et testnet uniquement

## 8. Votes et droits de gouvernance
- Les CFD donnent des droits de vote (ERC20Votes)
- Délégation : auto-délégation au premier mint, redélégation possible avec `delegate()`
- CFD brûlés lors d'un remboursement, donc plus de voix sans argent engagé
- Les CFD restent transférables, le remboursement exige de les détenir **[À valider]**

## 9. Événements
CampaignCreated, ContributionReceived, RefundIssued, WithdrawalAuthorized, WithdrawalExecuted, CampaignFrozen, CampaignUnfrozen

## 10. Déploiement (ordre)
1. Déployer `CFDToken(admin)`
2. Déployer `Crowdfunding(adresseToken, admin)`
3. `token.grantRole(MINTER_ROLE, crowdfunding)` et `token.grantRole(BURNER_ROLE, crowdfunding)`
4. `crowdfunding.grantRole(GOVERNANCE_ROLE, dao)`