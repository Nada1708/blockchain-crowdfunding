export type ProposalType = 'Freeze' | 'EarlyRelease';
export type ProposalStatus = 'Active' | 'Passed' | 'Rejected';

export type GovernanceProposal = {
  id: number;
  titleKey: string;
  descriptionKey: string;
  campaignKey: string;
  type: ProposalType;
  status: ProposalStatus;
  periodKey: string;
  votesFor: number;
  votesAgainst: number;
  quorum: number;
};

export const governanceProposals: GovernanceProposal[] = [
  {
    id: 1,
    titleKey: 'governance.data.solarTitle',
    descriptionKey: 'governance.data.solarDescription',
    campaignKey: 'campaignData.solarTitle',
    type: 'EarlyRelease',
    status: 'Active',
    periodKey: 'governance.periods.open',
    votesFor: 1840,
    votesAgainst: 420,
    quorum: 3000,
  },
  {
    id: 2,
    titleKey: 'governance.data.oceanTitle',
    descriptionKey: 'governance.data.oceanDescription',
    campaignKey: 'campaignData.oceanTitle',
    type: 'Freeze',
    status: 'Passed',
    periodKey: 'governance.periods.closed',
    votesFor: 2680,
    votesAgainst: 710,
    quorum: 2800,
  },
  {
    id: 3,
    titleKey: 'governance.data.creatorTitle',
    descriptionKey: 'governance.data.creatorDescription',
    campaignKey: 'campaignData.creatorsTitle',
    type: 'Freeze',
    status: 'Rejected',
    periodKey: 'governance.periods.closed',
    votesFor: 860,
    votesAgainst: 1940,
    quorum: 2600,
  },
];
