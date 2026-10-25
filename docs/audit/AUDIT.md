# Audit statique — Slither

## Contexte

| Élément | Valeur |
|---|---|
| Outil | Slither 0.11.6 (crytic-compile 0.4.2) |
| Compilateur | solc 0.8.34 (via Hardhat 3) |
| Commande | `slither . --filter-paths "node_modules\|mocks\|Counter\|\.t\.sol"` |
| Périmètre | `CFDGovernance.sol`, `MultiSigTreasury.sol` |
| Exclus | OpenZeppelin (audité en amont), mocks et fichiers de test |
| Détecteurs | 102 |

## Résultats

| | High | Medium | Low | Informational | Total |
|---|---|---|---|---|---|
| **Initial** | 0 | 0 | 3 | 1 | 4 |
| **Final** | 0 | 0 | 2 | 1 | 3 |

## Analyse des alertes

| ID | Détecteur | Gravité | Emplacement | Qualification | Action | Statut |
|---|---|---|---|---|---|---|
| 0 | reentrancy-events | Low | `CFDGovernance.execute` | Vrai positif mineur : l'événement `ProposalExecuted` était émis après l'appel externe au Crowdfunding. Pas de vol ni de double exécution possible (`executed = true` est écrit avant l'appel), mais risque de journal désordonné pour le frontend et l'analyse hors-chaîne. | Événement déplacé avant l'appel externe (Checks-Effects-Interactions strict) | ✅ Corrigé |
| 1 | timestamp | Low | `CFDGovernance.castVote` | Un validateur ne peut décaler `block.timestamp` que de quelques secondes (créneaux de 12 s en Proof of Stake), ce qui est négligeable face à un vote de 48 h. | Aucune, risque accepté | ✅ Accepté |
| 2 | timestamp | Low | `CFDGovernance.state` | Idem ID-1. Les lignes du quorum sont un faux positif : elles ne dépendent pas du temps, elles sont seulement dans la même fonction. | Aucune, risque accepté | ✅ Accepté |
| 3 | low-level-calls | Info | `MultiSigTreasury.execute` | `.call` est nécessaire pour transmettre des ETH et des données, et recommandé à la place de `transfer` (limite de gas). Protections : valeur de retour vérifiée, CEI (`executed = true` avant l'appel), `nonReentrant`, 2 signatures sur 3. | Aucune, usage justifié | ✅ Accepté |

## Correction appliquée (ID-0)

**Avant :**
```solidity
p.executed = true;
crowdfunding.freezeCampaign(p.campaignId);   // appel externe
emit ProposalExecuted(id);                   // événement APRÈS
```

**Après :**
```solidity
p.executed = true;
emit ProposalExecuted(id);                   // événement AVANT
crowdfunding.freezeCampaign(p.campaignId);   // appel externe
```

Si l'appel externe échoue, toute la transaction est annulée, y compris l'événement :
aucun événement ne peut donc annoncer une exécution qui a échoué.

Vérification : 26 tests passent après la correction, et l'alerte a disparu du rapport final.

## Limites

Une analyse statique ne prouve pas l'absence de vulnérabilités. Elle complète :
- les tests unitaires (26 tests) ;
- le test d'attaque par reentrancy (`test_ReentrancyAttackBlocked`) ;
- le fuzzing (`testFuzz_VoteWeightEqualsSnapshotBalance`, `testFuzz_NonSignerCannotSubmit`).

## Rapports bruts

- `slither-report-initial.md` : avant correction (4 alertes)
- `slither-report-final.md` : après correction (3 alertes)