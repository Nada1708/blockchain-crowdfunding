# Modèle de sécurité — Fundora

Périmètre : `CFDToken.sol`, `Crowdfunding.sol`, `CFDGovernance.sol` et
`MultiSigTreasury.sol`.

## 1. Actifs et séparation des fonds

| Actif | Propriété de sécurité |
|---|---|
| ETH des campagnes dans `Crowdfunding` | Escrow affecté aux contributeurs et bénéficiaires ; retraits gouvernés par la DAO, remboursements selon l'état de campagne |
| ETH de `MultiSigTreasury` | Trésorerie administrative ; aucune sortie sans deux signatures |
| CFD et pouvoir de vote | Mint/burn contrôlés, snapshots historiques et absence de double vote |
| Décisions DAO | Quorum, majorité, délai de 48 h et exécution unique |
| Rôles administratifs | Détenus par le multisig après révocation du déployeur |

Les fonds de campagnes ne doivent pas être transférés dans la trésorerie : cela
mélangerait l'escrow avec les actifs administratifs et permettrait au multisig
de se substituer aux règles de remboursement, à la DAO ou au bénéficiaire.

## 2. Acteurs menaçants

| Acteur | Capacité considérée |
|---|---|
| Attaquant externe | Appels publics et déploiement de contrats malveillants |
| Détenteur CFD malveillant | Vote, transfert ou acquisition temporaire de jetons |
| Bénéficiaire malhonnête | Tentative de retrait sans autorisation DAO |
| Signataire compromis | Contrôle d'une clé sur trois |
| Créateur malhonnête | Annulation ou métadonnées trompeuses |

## 3. Menaces, protections et preuves

| # | Menace | Protection actuelle | Preuve principale |
|---|---|---|---|
| T1 | Acquisition éclair de CFD | Snapshot `clock() - 1` et `getPastVotes` | `test_SnapshotBlocksFlashVote`, `testFuzz_VoteWeightEqualsSnapshotBalance` |
| T2 | Double vote après transfert | Snapshot et `hasVoted` | `test_TransferAfterSnapshotDoesNotDoubleVote`, `test_RevertWhen_DoubleVote` |
| T3 | Décision d'une minorité | Quorum 20 % et majorité stricte | `test_DefeatedWhenQuorumNotReached` |
| T4 | Vote hors délai | Revert `VotingClosed` à `voteEnd` | `test_RevertWhen_VoteAfterDeadline` |
| T5 | Exécution répétée | `executed = true` avant interaction | Tests `test_RevertWhen_ExecuteTwice` DAO et multisig |
| T6 | Déblocage demandé par un tiers | EarlyRelease réservé au bénéficiaire | `test_RevertWhen_NonBeneficiaryAsksRelease` |
| T7 | Spam Freeze/Unfreeze | Seuil de 100 CFD au snapshot | Tests `BelowProposalThreshold` |
| T8 | Réentrance sur remboursement | CEI et `nonReentrant` | Test Hardhat « bloque une attaque de réentrance sur refund » |
| T9 | Réentrance du destinataire multisig | CEI et `nonReentrant` | `test_ReentrancyAttackBlocked` |
| T10 | Un signataire vide la trésorerie | Deux confirmations distinctes sur trois | `test_RevertWhen_OnlyOneSignature`, `test_RevertWhen_SameSignerConfirmsTwice` |
| T11 | Signataires dupliqués | Validation au constructeur | `test_RevertWhen_DuplicateSigners` |
| T12 | Opération multisig par un tiers | Modificateur `onlySigner` | `test_RevertWhen_OutsiderExecutes`, `testFuzz_NonSignerCannotSubmit` |
| T13 | Incident actif | `Pausable` sur Crowdfunding et DAO | Tests de pause et intégration multisig |
| T14 | Administration résiduelle du déployeur | Transfert au multisig puis révocation bootstrap | `FundoraIntegration` et `verify-local-deployment.mjs` |
| T15 | Faux token ou faux Crowdfunding | Références immutable et adresses non nulles | Constructeurs et vérification locale |

## 4. Choix de conception

| Choix | Justification |
|---|---|
| Snapshot au bloc précédent | Les lectures historiques exigent un bloc strictement passé et excluent les jetons acquis dans le bloc de proposition |
| Vote ouvert pendant une pause DAO | La période de 48 h continue ; la pause bloque création et exécution, pas l'expression des votes |
| Multisig 2-sur-3 | Une clé compromise ne suffit pas ; une clé indisponible ne bloque pas le coffre |
| Rôles admin/pauser au multisig | Aucune personne seule ne peut administrer ou mettre en pause |
| Exécution DAO par transaction | Le contrat vérifie l'état Succeeded ; aucun smart contract ne s'exécute spontanément |
| Auto-délégation au premier mint | Les CFD reçus donnent immédiatement des voix sans étape manuelle oubliable |
| OpenZeppelin | Primitives standard pour ERC-20, votes, rôles, pause et anti-réentrance |

## 5. Paramètres justifiés

| Paramètre | Valeur | Justification |
|---|---:|---|
| Taux | 1 ETH = 1 000 CFD | Rend 0,1 ETH équivalent au seuil de proposition de 100 CFD |
| Contribution minimale | 0,01 ETH | Limite le spam de micro-contributions |
| Durée maximale | 365 jours | Évite les campagnes sans horizon raisonnable |
| Durée du vote | 48 h | Participation possible sans bloquer excessivement une urgence |
| Quorum | 20 % au snapshot | Empêche une petite minorité de décider sans exiger une participation irréaliste |
| Majorité | `forVotes > againstVotes` | Majorité stricte des voix exprimées |
| Seuil Freeze/Unfreeze | 100 CFD | Anti-spam, atteint par une contribution de 0,1 ETH |
| Multisig | 2 signatures sur 3 | Équilibre sécurité et disponibilité |
| Seuil documentaire de trésorerie | 1 ETH | Sortie significative, égale à 100 contributions minimales ; le contrat exige 2-sur-3 pour tout montant |

Le seuil de 1 ETH concerne uniquement les fonds détenus par
`MultiSigTreasury`. La politique on-chain est plus stricte que l'exigence : une
sortie de 0,1 ETH comme une sortie de 3 ETH exige deux signatures.

## 6. Vérifications disponibles

- **101 tests passent** lors de l'audit final de livraison : 54 Hardhat/Solidity
  et Mocha, 17 frontend et 30 API/SIWE.
- Les tests Solidity comprennent deux scénarios métier de fuzzing à 256 essais
  chacun et des attaques de réentrance sur `refund` et le multisig.
- Le script `scripts/verify-local-deployment.mjs` contrôle la chaîne 31337, les
  quatre bytecodes, les liens entre contrats, les rôles, les révocations du
  déployeur, les trois signataires et `REQUIRED == 2`.
- Audit Slither final des quatre contrats :
  [`audit/AUDIT.md`](audit/AUDIT.md) et
  [`audit/slither-report-final-4-contracts.md`](audit/slither-report-final-4-contracts.md).
- Slither : 0 High, 0 Medium, 7 Low qualifiés et 3 Informational qualifiés.

## 7. Limites connues

| Limite | Conséquence | Mesure ou amélioration |
|---|---|---|
| Pas de timelock après adoption | Pas de fenêtre supplémentaire avant exécution | Ajouter un TimelockController pour une version de production |
| Signataires fixes | Remplacement d'une clé compromise impossible | Prévoir une rotation gouvernée dans une version ultérieure |
| Sessions SIWE en mémoire | Perte des sessions au redémarrage, non adapté au multi-instance | Stockage partagé en production |
| Audit statique uniquement | Ne prouve pas l'absence de vulnérabilités | Audit manuel/externe avant gestion de fonds réels |
| Démonstration locale | Comptes Hardhat et adresses non persistants | Ne jamais réutiliser les clés locales ; documenter chaque déploiement |
