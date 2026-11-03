export type CampaignStatus = 'Active' | 'Successful' | 'Failed';

export type Campaign = {
  id: number;
  titleKey: string;
  descriptionKey: string;
  image: string;
  goal: number;
  raised: number;
  status: CampaignStatus;
};

export const featuredCampaigns: Campaign[] = [
  {
    id: 1,
    titleKey: 'campaignData.solarTitle',
    descriptionKey: 'campaignData.solarDescription',
    image:
      'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=900&q=80',
    goal: 40,
    raised: 31.6,
    status: 'Active',
  },
  {
    id: 2,
    titleKey: 'campaignData.oceanTitle',
    descriptionKey: 'campaignData.oceanDescription',
    image:
      'https://images.unsplash.com/photo-1484291470158-b8f8d608850d?auto=format&fit=crop&w=900&q=80',
    goal: 65,
    raised: 65,
    status: 'Successful',
  },
  {
    id: 3,
    titleKey: 'campaignData.creatorsTitle',
    descriptionKey: 'campaignData.creatorsDescription',
    image:
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80',
    goal: 25,
    raised: 18.75,
    status: 'Failed',
  },
];
