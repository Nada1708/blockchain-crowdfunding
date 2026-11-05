# Sortie Slither finale — quatre contrats métier

- Date : 5 novembre 2026
- Slither : 0.11.6
- crytic-compile : 0.4.2
- solc : 0.8.34 via Hardhat 3
- Commande : `slither . --filter-paths "node_modules\|mocks\|Counter\|\.t\.sol" --show-ignored-findings --checklist`
- Résultat : 72 contrats analysés, 102 détecteurs, 10 findings
- Code de sortie : 1 (findings présents)

Les dépendances ont été compilées. Les dépendances, mocks, tests et `Counter`
ont été filtrés de la restitution pour cibler les quatre contrats métier. Aucun
détecteur n'a été exclu. `--show-ignored-findings` a retourné les mêmes résultats.

## Summary

- High : 0
- Medium : 0
- `reentrancy-events` : 1 résultat Low
- `timestamp` : 6 résultats Low
- `low-level-calls` : 3 résultats Informational

## Findings

1. **Low — `reentrancy-events`** : `Crowdfunding.contribute(uint256)`
   (`Crowdfunding.sol:91-104`) appelle `token.mint` ligne 102 avant d'émettre
   `ContributionReceived` ligne 103.
2. **Low — `timestamp`** : `CFDGovernance.state(uint256)`
   (`CFDGovernance.sol:164-176`) compare `block.timestamp` à `voteEnd` ; Slither
   associe aussi les expressions de quorum de la fonction.
3. **Low — `timestamp`** : `Crowdfunding.refund(uint256)`
   (`Crowdfunding.sol:111-129`) utilise la deadline pour déterminer l'échec.
4. **Low — `timestamp`** : `Crowdfunding.contribute(uint256)`
   (`Crowdfunding.sol:91-104`) refuse les contributions après la deadline.
5. **Low — `timestamp`** : `Crowdfunding.isActive(uint256)`
   (`Crowdfunding.sol:196-200`) compare la deadline dans une vue.
6. **Low — `timestamp`** : `CFDGovernance.castVote(uint256,bool)`
   (`CFDGovernance.sol:133-154`) ferme le vote à `voteEnd`.
7. **Low — `timestamp`** : `Crowdfunding.status(uint256)`
   (`Crowdfunding.sol:207-212`) utilise la deadline dans une vue.
8. **Informational — `low-level-calls`** : `Crowdfunding.withdrawFunds`
   (`Crowdfunding.sol:133-146`) utilise `beneficiary.call` ligne 143.
9. **Informational — `low-level-calls`** : `MultiSigTreasury.execute`
   (`MultiSigTreasury.sol:102-111`) utilise `t.to.call` ligne 107.
10. **Informational — `low-level-calls`** : `Crowdfunding.refund`
    (`Crowdfunding.sol:111-129`) utilise `msg.sender.call` ligne 126.

Slither a analysé 72 contrats avec 102 détecteurs et trouvé 10 résultats. Aucun
finding High ou Medium n'a été signalé. La qualification complète figure dans
`AUDIT.md` ; aucune alerte listée ici n'y est supprimée ou masquée.
