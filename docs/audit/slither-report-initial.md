'npx hardhat clean' running (wd: C:\Projets\blockchain-crowdfunding)
'npx hardhat clean --global' running (wd: C:\Projets\blockchain-crowdfunding)
'npx hardhat compile --force' running (wd: C:\Projets\blockchain-crowdfunding)
**THIS CHECKLIST IS NOT COMPLETE**. Use `--show-ignored-findings` to show all the results.
Summary
 - [reentrancy-events](#reentrancy-events) (1 results) (Low)
 - [timestamp](#timestamp) (2 results) (Low)
 - [low-level-calls](#low-level-calls) (1 results) (Informational)
## reentrancy-events
Impact: Low
Confidence: Medium
 - [ ] ID-0
Reentrancy in [CFDGovernance.execute(uint256)](contracts/CFDGovernance.sol#L173-L190):
	External calls:
	- [crowdfunding.freezeCampaign(p.campaignId)](contracts/CFDGovernance.sol#L184)
	- [crowdfunding.approveEarlyRelease(p.campaignId,p.amount)](contracts/CFDGovernance.sol#L186)
	Event emitted after the call(s):
	- [ProposalExecuted(id)](contracts/CFDGovernance.sol#L189)

contracts/CFDGovernance.sol#L173-L190


## timestamp
Impact: Low
Confidence: Medium
 - [ ] ID-1
[CFDGovernance.castVote(uint256,bool)](contracts/CFDGovernance.sol#L127-L148) uses timestamp for comparisons
	Dangerous comparisons:
	- [block.timestamp >= p.voteEnd](contracts/CFDGovernance.sol#L132)

contracts/CFDGovernance.sol#L127-L148


 - [ ] ID-2
[CFDGovernance.state(uint256)](contracts/CFDGovernance.sol#L158-L170) uses timestamp for comparisons
	Dangerous comparisons:
	- [block.timestamp < p.voteEnd](contracts/CFDGovernance.sol#L163)
	- [quorumReached = p.forVotes + p.againstVotes >= quorum(id)](contracts/CFDGovernance.sol#L165)
	- [quorumReached && majority](contracts/CFDGovernance.sol#L168)

contracts/CFDGovernance.sol#L158-L170


## low-level-calls
Impact: Informational
Confidence: High
 - [ ] ID-3
Low level call in [MultiSigTreasury.execute(uint256)](contracts/MultiSigTreasury.sol#L102-L111):
	- [(ok,None) = t.to.call{value: t.value}(t.data)](contracts/MultiSigTreasury.sol#L107)

contracts/MultiSigTreasury.sol#L102-L111


