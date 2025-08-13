import { describe, it, expect, beforeEach } from "vitest";

interface Proposal {
  proposer: string;
  description: string;
  votingDeadline: bigint;
  yesVotes: bigint;
  noVotes: bigint;
  executed: boolean;
  targetContract?: string;
}

interface MockContract {
  admin: string;
  paused: boolean;
  totalVotingPower: bigint;
  proposalCounter: bigint;
  proposals: Map<string, Proposal>;
  votes: Map<string, boolean>;
  voterPower: Map<string, bigint>;
  nftContract: string;
  MINIMUM_QUORUM: bigint;
  MIN_VOTING_DURATION: bigint;
  MAX_VOTING_DURATION: bigint;
  isAdmin(caller: string): boolean;
  transferAdmin(caller: string, newAdmin: string): { value: boolean } | { error: number };
  setNftContract(caller: string, newContract: string): { value: boolean } | { error: number };
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  updateVoterPower(caller: string, voter: string, power: bigint): { value: boolean } | { error: number };
  createProposal(caller: string, description: string, votingDuration: bigint, targetContract?: string): { value: bigint } | { error: number };
  vote(caller: string, proposalId: bigint, voteYes: boolean): { value: boolean } | { error: number };
  executeProposal(caller: string, proposalId: bigint): { value: boolean } | { error: number };
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  totalVotingPower: 0n,
  proposalCounter: 0n,
  proposals: new Map<string, Proposal>(),
  votes: new Map<string, boolean>(),
  voterPower: new Map<string, bigint>(),
  nftContract: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  MINIMUM_QUORUM: 10n,
  MIN_VOTING_DURATION: 1440n,
  MAX_VOTING_DURATION: 10080n,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  transferAdmin(caller: string, newAdmin: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newAdmin === "SP000000000000000000002Q6VF78") return { error: 105 };
    this.admin = newAdmin;
    return { value: true };
  },

  setNftContract(caller: string, newContract: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newContract === "SP000000000000000000002Q6VF78") return { error: 105 };
    this.nftContract = newContract;
    return { value: true };
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.paused = pause;
    return { value: pause };
  },

  updateVoterPower(caller: string, voter: string, power: bigint) {
    if (!this.isAdmin(caller) && caller !== this.nftContract) return { error: 100 };
    const currentPower = this.voterPower.get(voter) || 0n;
    this.voterPower.set(voter, power);
    this.totalVotingPower = this.totalVotingPower - currentPower + power;
    return { value: true };
  },

  createProposal(caller: string, description: string, votingDuration: bigint, targetContract?: string) {
    if (this.paused) return { error: 104 };
    if (description.length === 0) return { error: 108 };
    if (votingDuration < this.MIN_VOTING_DURATION || votingDuration > this.MAX_VOTING_DURATION) return { error: 108 };
    const voterPower = this.voterPower.get(caller) || 0n;
    if (voterPower === 0n) return { error: 106 };
    const proposalId = this.proposalCounter + 1n;
    const deadline = BigInt(blockHeight) + votingDuration;
    this.proposals.set(proposalId.toString(), {
      proposer: caller,
      description,
      votingDeadline: deadline,
      yesVotes: 0n,
      noVotes: 0n,
      executed: false,
      targetContract,
    });
    this.proposalCounter = proposalId;
    return { value: proposalId };
  },

  vote(caller: string, proposalId: bigint, voteYes: boolean) {
    if (this.paused) return { error: 104 };
    const proposalKey = proposalId.toString();
    const proposal = this.proposals.get(proposalKey);
    if (!proposal) return { error: 101 };
    if (BigInt(blockHeight) >= proposal.votingDeadline) return { error: 103 };
    if (proposal.executed) return { error: 109 };
    if (this.votes.has(`${proposalId}-${caller}`)) return { error: 102 };
    const voterPower = this.voterPower.get(caller) || 0n;
    if (voterPower === 0n) return { error: 106 };
    this.votes.set(`${proposalId}-${caller}`, voteYes);
    this.proposals.set(proposalKey, {
      ...proposal,
      yesVotes: voteYes ? proposal.yesVotes + voterPower : proposal.yesVotes,
      noVotes: voteYes ? proposal.noVotes : proposal.noVotes + voterPower,
    });
    return { value: true };
  },

  executeProposal(caller: string, proposalId: bigint) {
    if (this.paused) return { error: 104 };
    const proposalKey = proposalId.toString();
    const proposal = this.proposals.get(proposalKey);
    if (!proposal) return { error: 101 };
    if (BigInt(blockHeight) < proposal.votingDeadline) return { error: 103 };
    if (proposal.executed) return { error: 109 };
    const totalVotes = proposal.yesVotes + proposal.noVotes;
    const quorum = (this.totalVotingPower * this.MINIMUM_QUORUM) / 100n;
    if (totalVotes < quorum) return { error: 107 };
    if (proposal.yesVotes <= proposal.noVotes) return { error: 107 };
    this.proposals.set(proposalKey, { ...proposal, executed: true });
    return { value: true };
  },
};

// Mock block height for testing
let blockHeight = 1000;

describe("Fantasy League DAO Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.totalVotingPower = 0n;
    mockContract.proposalCounter = 0n;
    mockContract.proposals = new Map();
    mockContract.votes = new Map();
    mockContract.voterPower = new Map();
    mockContract.nftContract = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    blockHeight = 1000;
  });

  it("should transfer admin rights", () => {
    const result = mockContract.transferAdmin(mockContract.admin, "ST2CY5...");
    expect(result).toEqual({ value: true });
    expect(mockContract.admin).toBe("ST2CY5...");
  });

  it("should prevent non-admin from transferring admin rights", () => {
    const result = mockContract.transferAdmin("ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 100 });
  });

  it("should set NFT contract", () => {
    const result = mockContract.setNftContract(mockContract.admin, "ST2CY5...");
    expect(result).toEqual({ value: true });
    expect(mockContract.nftContract).toBe("ST2CY5...");
  });

  it("should update voter power by admin or NFT contract", () => {
    const result = mockContract.updateVoterPower(mockContract.admin, "ST2CY5...", 100n);
    expect(result).toEqual({ value: true });
    expect(mockContract.voterPower.get("ST2CY5...")).toBe(100n);
    expect(mockContract.totalVotingPower).toBe(100n);
  });

  it("should create a proposal", () => {
    mockContract.voterPower.set("ST2CY5...", 100n);
    mockContract.totalVotingPower = 100n;
    const result = mockContract.createProposal("ST2CY5...", "Update league rules", 1440n, "ST3NB...");
    expect(result).toEqual({ value: 1n });
    expect(mockContract.proposals.get("1")).toEqual({
      proposer: "ST2CY5...",
      description: "Update league rules",
      votingDeadline: 2440n,
      yesVotes: 0n,
      noVotes: 0n,
      executed: false,
      targetContract: "ST3NB...",
    });
  });

  it("should prevent proposal creation with no voter power", () => {
    const result = mockContract.createProposal("ST2CY5...", "Update league rules", 1440n);
    expect(result).toEqual({ error: 106 });
  });

  it("should allow voting on a proposal", () => {
    mockContract.voterPower.set("ST2CY5...", 100n);
    mockContract.totalVotingPower = 100n;
    mockContract.createProposal("ST2CY5...", "Update league rules", 1440n);
    const result = mockContract.vote("ST2CY5...", 1n, true);
    expect(result).toEqual({ value: true });
    expect(mockContract.proposals.get("1")?.yesVotes).toBe(100n);
  });

  it("should prevent double voting", () => {
    mockContract.voterPower.set("ST2CY5...", 100n);
    mockContract.totalVotingPower = 100n;
    mockContract.createProposal("ST2CY5...", "Update league rules", 1440n);
    mockContract.vote("ST2CY5...", 1n, true);
    const result = mockContract.vote("ST2CY5...", 1n, false);
    expect(result).toEqual({ error: 102 });
  });

  it("should execute a proposal after voting", () => {
    mockContract.voterPower.set("ST2CY5...", 100n);
    mockContract.totalVotingPower = 100n;
    mockContract.createProposal("ST2CY5...", "Update league rules", 1440n);
    mockContract.vote("ST2CY5...", 1n, true);
    blockHeight = 2441;
    const result = mockContract.executeProposal("ST2CY5...", 1n);
    expect(result).toEqual({ value: true });
    expect(mockContract.proposals.get("1")?.executed).toBe(true);
  });

  it("should prevent execution before voting deadline", () => {
    mockContract.voterPower.set("ST2CY5...", 100n);
    mockContract.totalVotingPower = 100n;
    mockContract.createProposal("ST2CY5...", "Update league rules", 1440n);
    mockContract.vote("ST2CY5...", 1n, true);
    const result = mockContract.executeProposal("ST2CY5...", 1n);
    expect(result).toEqual({ error: 103 });
  });

  it("should prevent execution without quorum", () => {
    mockContract.voterPower.set("ST2CY5...", 5n);
    mockContract.totalVotingPower = 100n;
    mockContract.createProposal("ST2CY5...", "Update league rules", 1440n);
    mockContract.vote("ST2CY5...", 1n, true);
    blockHeight = 2441;
    const result = mockContract.executeProposal("ST2CY5...", 1n);
    expect(result).toEqual({ error: 107 });
  });

  it("should not allow actions when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    mockContract.voterPower.set("ST2CY5...", 100n);
    mockContract.totalVotingPower = 100n;
    const createResult = mockContract.createProposal("ST2CY5...", "Update league rules", 1440n);
    const voteResult = mockContract.vote("ST2CY5...", 1n, true);
    const executeResult = mockContract.executeProposal("ST2CY5...", 1n);
    expect(createResult).toEqual({ error: 104 });
    expect(voteResult).toEqual({ error: 104 });
    expect(executeResult).toEqual({ error: 104 });
  });
});