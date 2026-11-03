import assert from 'node:assert/strict'
import test from 'node:test'
import {
  campaignAcceptsProposal,
  proposalKindFromValue,
  proposalKindValue,
  requiresProposalThreshold,
} from './governance-proposal.ts'

test('keeps existing proposal enum values and appends Unfreeze', () => {
  assert.equal(proposalKindValue('Freeze'), 0)
  assert.equal(proposalKindValue('EarlyRelease'), 1)
  assert.equal(proposalKindValue('Unfreeze'), 2)
  assert.equal(proposalKindFromValue(2), 'Unfreeze')
})

test('Unfreeze uses the threshold and accepts only frozen campaigns', () => {
  assert.equal(requiresProposalThreshold('Unfreeze'), true)
  assert.equal(campaignAcceptsProposal('Unfreeze', { status: 'Active', frozen: true }), true)
  assert.equal(campaignAcceptsProposal('Unfreeze', { status: 'Active', frozen: false }), false)
  assert.equal(campaignAcceptsProposal('Freeze', { status: 'Active', frozen: true }), false)
})
