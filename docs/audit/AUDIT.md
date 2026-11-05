# Audit statique — Slither

## Audit final du 5 novembre 2026

| Élément | Valeur |
|---|---|
| Outil | Slither 0.11.6 (`crytic-compile` 0.4.2) |
| Compilateur | solc 0.8.34 via Hardhat 3 |
| Commande | `slither . --filter-paths "node_modules\|mocks\|Counter\|\.t\.sol" --show-ignored-findings --checklist` |
| Contrats métier | `CFDToken.sol`, `Crowdfunding.sol`, `CFDGovernance.sol`, `MultiSigTreasury.sol` |
| Éléments filtrés | Dépendances, mocks, `Counter` et tests Solidity |
| Analyse | 72 contrats compilés, 102 détecteurs, aucun détecteur désactivé |

L'analyse a été exécutée dans une copie temporaire isolée. Elle n'a modifié ni
les contrats, ni un déploiement, ni les services. Un second passage avec
`--show-ignored-findings` a produit exactement les mêmes résultats : aucune
alerte précédemment triée n'était masquée.

## Résultats

| Criticité | Nombre | Verdict |
|---|---:|---|
| High | 0 | PASS |
| Medium | 0 | PASS |
| Low | 7 | WARNING — analysés ci-dessous |
| Informational | 3 | INFO — usages justifiés |
| **Total** | **10** | **Aucun finding High ou Medium** |

## Qualification exhaustive

| ID | Détecteur | Criticité | Emplacement | Qualification et action |
|---|---|---|---|---|
| F-01 | `reentrancy-events` | Low | `Crowdfunding.contribute` | `token` est immutable et référence `CFDToken`, ERC-20 sans hook ni callback. Les effets `contributions` et `raised` précèdent `mint`. L'événement après le mint décrit une opération finalisée. Risque non exploitable dans l'architecture actuelle ; accepté. |
| F-02 | `timestamp` | Low | `CFDGovernance.castVote` | Nécessaire pour fermer le vote de 48 h. Une faible variation ne contourne ni snapshot, ni quorum, ni majorité ; accepté. |
| F-03 | `timestamp` | Low | `CFDGovernance.state` | Nécessaire pour distinguer vote actif et terminé. Les expressions de quorum signalées dans la même fonction ne dépendent pas du temps ; accepté. |
| F-04 | `timestamp` | Low | `Crowdfunding.contribute` | Deadline métier ; une faible variation au bord de la période ne permet ni vol ni retrait non autorisé ; accepté. |
| F-05 | `timestamp` | Low | `Crowdfunding.refund` | Nécessaire pour déterminer l'échec après deadline. Le remboursement reste conditionné et `nonReentrant` ; accepté. |
| F-06 | `timestamp` | Low | `Crowdfunding.isActive` | Vue dérivée de la deadline, sans mutation ni transfert ; accepté. |
| F-07 | `timestamp` | Low | `Crowdfunding.status` | Vue dérivée de la deadline, sans mutation ni transfert ; accepté. |
| F-08 | `low-level-calls` | Informational | `Crowdfunding.refund` | `.call` nécessaire pour l'ETH ; retour vérifié, effets avant appel et `nonReentrant` ; accepté. |
| F-09 | `low-level-calls` | Informational | `Crowdfunding.withdrawFunds` | Montant autorisé par DAO, bénéficiaire vérifié, effets avant appel, retour contrôlé et `nonReentrant` ; accepté. |
| F-10 | `low-level-calls` | Informational | `MultiSigTreasury.execute` | Appel générique nécessaire ; transaction marquée exécutée avant appel, retour contrôlé, `nonReentrant` et deux confirmations ; accepté. |

`CFDToken.sol` n'a produit aucun finding direct. Les alertes de
`Crowdfunding.sol`, absentes de l'ancien périmètre documentaire, sont désormais
conservées et qualifiées. Le code de sortie Slither `1` est attendu lorsque des
findings existent et ne représente pas un échec de compilation.

## Historique de la correction antérieure

L'audit initial avait identifié `reentrancy-events` dans
`CFDGovernance.execute`, car `ProposalExecuted` était émis après l'appel externe.
La correction déjà appliquée place l'effet et l'événement avant l'interaction :

```solidity
p.executed = true;
emit ProposalExecuted(id);
crowdfunding.freezeCampaign(p.campaignId);
```

Ce finding a disparu. Si l'appel externe échoue, la transaction entière est
annulée, événement compris.

## Exigence multisignature et seuil de trésorerie

Le cahier des charges impose le 2-sur-3 pour tout retrait de trésorerie dépassant
un seuil défini par l'équipe. Deux catégories doivent être distinguées :

1. **Fonds de campagnes** : ETH des contributeurs conservé dans `Crowdfunding`.
   C'est un escrow affecté à chaque campagne, pas la trésorerie de
   l'organisation. Les retraits reviennent au bénéficiaire après autorisation
   DAO ; les remboursements reviennent aux contributeurs.
2. **Trésorerie multisig** : ETH envoyé volontairement à `MultiSigTreasury`
   pour les opérations de l'organisation. Tout transfert sortant passe déjà par
   `submit`, deux confirmations distinctes et `execute`, quel que soit le montant.

### Politique minimale conforme proposée

- **Seuil : 1 ETH.** Dans ce prototype, il représente 100 fois la contribution
  minimale de 0,01 ETH et constitue une opération significative justifiant la
  séparation des pouvoirs.
- Tout retrait de la trésorerie strictement supérieur à 1 ETH exige deux des
  trois signataires.
- La politique actuelle est plus stricte : elle exige 2-sur-3 même à 1 ETH ou
  moins. Elle satisfait donc l'obligation au-dessus du seuil sans changement de
  logique.
- Les fonds de campagnes ne doivent pas passer par le coffre : cela mélangerait
  trésorerie administrative et escrow, et permettrait aux signataires de se
  substituer à la DAO ou aux bénéficiaires.

`test_TwoOfThreeExecutes` couvre déjà 3 ETH, donc un retrait supérieur au seuil,
et `test_RevertWhen_OnlyOneSignature` prouve qu'une signature ne suffit pas.

## Impacts

| Composant | Impact minimal recommandé |
|---|---|
| Solidity | Aucun si la politique stricte « 2-sur-3 pour tout montant » est conservée. Ne pas ajouter une constante inutilisée. |
| DAO | Aucun : elle autorise les fonds de campagnes, sans administrer la trésorerie multisig. |
| Frontend | Aucun : aucune UI de retrait de trésorerie. Une future UI multisig devra afficher seuil et confirmations. |
| Déploiement | Aucun redéploiement pour la correction documentaire. Toute modification du bytecode imposerait de nouvelles adresses. |
| Tests | Les 101 tests restent inchangés. Un test nommé explicitement « au-dessus du seuil » améliorerait seulement la traçabilité. |

## Limites et archives

Slither ne prouve pas l'absence de vulnérabilités. Il complète les tests, le
fuzzing, les attaques de réentrance et la revue manuelle.

- `slither-report-initial.md` : audit antérieur avant correction ;
- `slither-report-final.md` : audit antérieur limité à DAO/multisig ;
- `slither-report-final-4-contracts.md` : audit final des quatre contrats.
