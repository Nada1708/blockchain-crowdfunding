import type { InterfaceAbi } from 'ethers'
import type { FundoraContractName } from '../config/contracts'
import { cfdGovernanceAbi } from './CFDGovernance'
import { cfdTokenAbi } from './CFDToken'
import { crowdfundingAbi } from './Crowdfunding'

export const CONTRACT_ABIS: Record<FundoraContractName, InterfaceAbi | null> = {
  CFDToken: cfdTokenAbi,
  Crowdfunding: crowdfundingAbi,
  CFDGovernance: cfdGovernanceAbi,
}
