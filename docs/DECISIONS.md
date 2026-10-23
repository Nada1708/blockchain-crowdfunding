# Décisions du projet Blockchain Crowdfunding

> Statut : propositions à valider collectivement avant l'implémentation.

## 1. Jeton CFD
- Nom : Crowdfunding Token
- Symbole : CFD
- Décimales : 18
- Offre initiale : à décider
- Création de nouveaux CFD (mint) : uniquement par le contrat Crowdfunding autorisé
- Propriétaire du token : à définir et sécuriser

## 2. Conversion ETH vers CFD
- Taux proposé : 1 ETH = 1000 CFD
- Statut du taux : à valider par l'équipe
- Calcul : utiliser les unités minimales du token et les wei, sans nombres flottants

## 3. Campagnes
- Objectif minimal : supérieur à zéro
- Durée : à décider
- Bénéficiaire : adresse fournie à la création de la campagne
- Métadonnées du projet : CID IPFS
- Contribution minimale : à décider
- Contribution maximale : à décider

## 4. Échec et remboursement
- Une campagne échoue si la date limite est passée et que l'objectif n'est pas atteint
- Remboursement : chaque contributeur réclame sa propre contribution
- Double remboursement : interdit
- Moment où les remboursements sont possibles : après la date limite, si l'objectif n'est pas atteint
- Traitement des CFD attribués lors d'un remboursement : à décider avec le membre 2

## 5. Réussite et retrait
- Une campagne réussit si l'objectif est atteint selon les règles définies par l'équipe
- Le bénéficiaire ne peut pas retirer avant l'autorisation de gouvernance
- Double retrait : interdit
- Les conditions exactes de retrait : à valider avec le membre 2

## 6. Gouvernance
- Adresse du contrat de gouvernance : configurée de manière contrôlée
- Fonction d'autorisation : authorizeWithdrawal(campaignId)
- Fonction de gel : freezeCampaign(campaignId)
- Qui peut autoriser un retrait : uniquement le contrat de gouvernance
- Qui peut geler une campagne : à définir avec le membre 2
- Conditions de dégel : à définir avec le membre 2

## 7. Sécurité
- Protection contre la réentrance : prévue pour les transferts d'ETH
- Ordre des opérations : Checks-Effects-Interactions
- Pause d'urgence : à définir avec le membre 2
- Multisignature : 2 signatures sur 3 pour les actions concernées
- Seuil financier nécessitant la multisignature : à décider
- Aucun ETH réel : développement local et testnet uniquement

## 8. Votes et droits de gouvernance
- Les CFD donnent-ils des droits de vote ? À décider
- Standard de vote : ERC20Votes si retenu par l'équipe
- Délégation des votes : à définir
- Moment de référence des votes (snapshot) : à définir avec le membre 2
- Neutralisation ou destruction des CFD après remboursement : à définir
- Transferts de CFD et impact sur les votes : à définir

## 9. Événements à prévoir
- CampaignCreated
- ContributionReceived
- RefundIssued
- WithdrawalAuthorized
- WithdrawalExecuted
- CampaignFrozen

Les noms définitifs des événements seront alignés sur le code.

## 10. Décisions à confirmer en équipe
- [ ] Valider le taux ETH/CFD
- [ ] Fixer la durée et les objectifs des campagnes
- [ ] Valider les règles d'échec et de remboursement
- [ ] Définir les conditions d'autorisation de retrait
- [ ] Définir la pause et les permissions de gel
- [ ] Définir le seuil multisignature 2-sur-3
- [ ] Décider des droits de vote et du traitement des CFD remboursés
