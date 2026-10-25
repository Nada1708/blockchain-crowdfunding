# Modèle de sécurité — Gouvernance DAO et trésorerie

Responsable : Membre 2 (Gouvernance & Cybersécurité)
Contrats : `CFDGovernance.sol`, `MultiSigTreasury.sol`

## 1. Ce qu'on protège (actifs)

| Actif | Pourquoi c'est critique |
|---|---|
| Les ETH des contributeurs | Argent réel en production : un vol est irréversible |
| Les décisions de gouvernance | Un gel ou un déblocage frauduleux détourne les fonds |
| Le pouvoir de vote (CFD) | Le manipuler revient à contrôler la DAO |

## 2. Qui peut attaquer (acteurs)

| Acteur | Capacité |
|---|---|
| Attaquant externe | Appelle n'importe quelle fonction publique, déploie des contrats malveillants |
| Détenteur de CFD malveillant | Vote, transfère ses jetons, emprunte des jetons (flash loan) |
| Bénéficiaire malhonnête | Tente de récupérer les fonds sans accord des contributeurs |
| Signataire corrompu ou piraté | Possède 1 clé sur 3 de la multisig |

## 3. Menaces, protections et preuves

| # | Menace | Notion de sécurité | Protection implémentée | Test qui le prouve |
|---|---|---|---|---|
| T1 | Prise de contrôle éclair : emprunter des CFD, voter, les rendre | Anti-manipulation de gouvernance | Snapshot : poids lu via `getPastVotes(voter, snapshot)`, photo prise à la création (`clock() - 1`) | `test_SnapshotBlocksFlashVote`, `testFuzz_VoteWeightEqualsSnapshotBalance` |
| T2 | Faire voter les mêmes jetons deux fois en les transférant | Intégrité du vote | Snapshot + `hasVoted[id][voter]` | `test_TransferAfterSnapshotDoesNotDoubleVote`, `test_RevertWhen_DoubleVote` |
| T3 | Décision prise par une minorité | Légitimité | Quorum de 20 % du total au snapshot + majorité stricte | `test_DefeatedWhenQuorumNotReached` |
| T4 | Voter après la clôture | Intégrité temporelle | `block.timestamp >= voteEnd` → `VotingClosed` | `test_RevertWhen_VoteAfterDeadline` |
| T5 | Exécuter deux fois une décision | Anti-rejeu | `executed = true` avant l'appel externe | `test_RevertWhen_ExecuteTwice` (DAO et multisig) |
| T6 | Demander le déblocage d'une campagne qui n'est pas la sienne | Contrôle d'accès | Seul `beneficiaryOf(campaignId)` peut proposer un déblocage | `test_RevertWhen_NonBeneficiaryAsksRelease` |
| T7 | Spam de propositions | Disponibilité | Seuil de 100 CFD au snapshot pour proposer un gel | `test_RevertWhen_FreezeProposerBelowThreshold` |
| T8 | Reentrancy : rappeler `execute` pendant un envoi d'ETH | Anti-reentrance | Pattern Checks-Effects-Interactions + `ReentrancyGuard` (`nonReentrant`) | `test_ReentrancyAttackBlocked` |
| T9 | Un seul signataire vide la trésorerie | Séparation des pouvoirs | Multisig 2-sur-3, signataires distincts | `test_RevertWhen_OnlyOneSignature`, `test_RevertWhen_SameSignerConfirmsTwice`, `test_RevertWhen_DuplicateSigners` |
| T10 | Un inconnu propose ou exécute une opération de trésorerie | Contrôle d'accès | Modificateur `onlySigner` | `test_RevertWhen_OutsiderExecutes`, `testFuzz_NonSignerCannotSubmit` |
| T11 | Incident en cours (bug, attaque) | Circuit breaker | `Pausable` : `propose` et `execute` bloqués ; le vote reste ouvert pour ne pas perdre les voix | `test_PauseBlocksExecution`, `test_PauseBlocksNewProposals` |
| T12 | Un attaquant déclenche la pause | Contrôle d'accès | `AccessControl` : `PAUSER_ROLE` uniquement (attribué à la multisig) | `test_RevertWhen_AttackerPauses` |
| T13 | Remplacer le jeton ou le Crowdfunding par une fausse version | Intégrité de configuration | Adresses `immutable`, vérifiées non nulles au déploiement | Revue de code |

## 4. Choix de conception justifiés

| Choix | Justification |
|---|---|
| Snapshot à `clock() - 1` | `getPastVotes` n'accepte qu'un moment strictement passé ; le bloc précédent exclut les jetons acquis dans le bloc de création |
| Vote non bloqué pendant la pause | Le délai de 48 h continue de courir ; bloquer le vote ferait perdre les voix. On bloque seulement l'exécution |
| Multisig 2-sur-3 plutôt que 3-sur-3 | Une clé perdue ne bloque pas la trésorerie, une clé volée ne suffit pas |
| `PAUSER_ROLE` donné à la multisig | Aucune personne seule ne peut geler le système |
| Exécution déclenchée par transaction | Un smart contract ne s'exécute jamais seul. N'importe qui peut appeler `execute()`, mais le contrat n'applique la décision que si le vote est réellement adopté |
| OpenZeppelin (`ERC20Votes`, `AccessControl`, `Pausable`, `ReentrancyGuard`) | Composants standards et audités : on ne réinvente pas la cryptographie ni la gestion des rôles |

## 5. Paramètres

| Paramètre | Valeur | Justification |
|---|---|---|
| Durée du vote | 48 h | Laisse le temps à tous de voter, sans bloquer une urgence trop longtemps |
| Quorum | 20 % des CFD au snapshot | Empêche une minorité de décider, sans exiger une participation irréaliste |
| Majorité | > 50 % des voix exprimées | Règle démocratique simple |
| Seuil de proposition (gel) | 100 CFD | Anti-spam, accessible à tout contributeur de 0,1 ETH |
| Multisig | 2 signatures sur 3 | Équilibre sécurité / disponibilité |

## 6. Vérification

- **26 tests** passent, dont **2 scénarios de fuzzing** (256 essais chacun)
- **Audit Slither** : 0 alerte haute ou moyenne ; 1 alerte corrigée, 3 justifiées (voir `docs/audit/AUDIT.md`)

## 7. Limites connues

| Limite | Conséquence | Piste d'amélioration |
|---|---|---|
| Les détenteurs doivent appeler `delegate()` pour voter | Des jetons non délégués comptent dans le quorum sans pouvoir voter | Auto-délégation au premier mint (Membre 1) |
| Pas de délai entre l'adoption et l'exécution (timelock) | Pas de fenêtre de réaction après un vote malveillant | Ajouter un `TimelockController` |
| Les signataires de la multisig sont fixes | Impossible de remplacer une clé compromise | Ajouter un remplacement de signataire voté en 2/3 |
| Audit uniquement statique | Ne prouve pas l'absence de failles | Audit manuel externe avant toute mise en production |