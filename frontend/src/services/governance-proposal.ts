export type ProposalKind = 'Freeze' | 'EarlyRelease' | 'Unfreeze'

export function proposalKindValue(kind: ProposalKind) {
  return kind === 'Freeze' ? 0 : kind === 'EarlyRelease' ? 1 : 2
}

export function proposalKindFromValue(value: number): ProposalKind {
  return value === 0 ? 'Freeze' : value === 1 ? 'EarlyRelease' : 'Unfreeze'
}

export function requiresProposalThreshold(kind: ProposalKind) {
  return kind === 'Freeze' || kind === 'Unfreeze'
}

export function campaignAcceptsProposal(
  kind: ProposalKind,
  campaign: { status: string; frozen: boolean },
) {
  return kind === 'Unfreeze'
    ? campaign.frozen
    : campaign.status === 'Active' && !campaign.frozen
}
