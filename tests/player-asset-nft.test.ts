import { describe, it, expect, beforeEach } from "vitest";

interface NFT {
  owner: string;
  playerId: bigint;
  metadata: string;
}

interface MockContract {
  admin: string;
  oracle: string;
  paused: boolean;
  totalNfts: bigint;
  nfts: Map<string, NFT>;
  playerMintCount: Map<string, bigint>;
  approvedOperators: Map<string, boolean>;
  MAX_MINT_PER_PLAYER: bigint;
  isAdmin(caller: string): boolean;
  isOracle(caller: string): boolean;
  transferAdmin(caller: string, newAdmin: string): { value: boolean } | { error: number };
  setOracle(caller: string, newOracle: string): { value: boolean } | { error: number };
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  mint(caller: string, playerId: bigint, recipient: string, metadata: string): { value: bigint } | { error: number };
  updateMetadata(caller: string, nftId: bigint, metadata: string): { value: boolean } | { error: number };
  transfer(caller: string, nftId: bigint, sender: string, recipient: string): { value: boolean } | { error: number };
  approveOperator(caller: string, nftId: bigint, operator: string): { value: boolean } | { error: number };
  revokeOperator(caller: string, nftId: bigint, operator: string): { value: boolean } | { error: number };
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  oracle: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  totalNfts: 0n,
  nfts: new Map<string, NFT>(),
  playerMintCount: new Map<string, bigint>(),
  approvedOperators: new Map<string, boolean>(),
  MAX_MINT_PER_PLAYER: 100n,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  isOracle(caller: string) {
    return caller === this.oracle;
  },

  transferAdmin(caller: string, newAdmin: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newAdmin === "SP000000000000000000002Q6VF78") return { error: 104 };
    this.admin = newAdmin;
    return { value: true };
  },

  setOracle(caller: string, newOracle: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newOracle === "SP000000000000000000002Q6VF78") return { error: 104 };
    this.oracle = newOracle;
    return { value: true };
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.paused = pause;
    return { value: pause };
  },

  mint(caller: string, playerId: bigint, recipient: string, metadata: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 104 };
    if (this.paused) return { error: 103 };
    const playerKey = playerId.toString();
    const currentCount = this.playerMintCount.get(playerKey) || 0n;
    if (currentCount >= this.MAX_MINT_PER_PLAYER) return { error: 105 };
    if (metadata === "") return { error: 107 };
    const newId = this.totalNfts + 1n;
    this.nfts.set(newId.toString(), { owner: recipient, playerId, metadata });
    this.playerMintCount.set(playerKey, currentCount + 1n);
    this.totalNfts = newId;
    return { value: newId };
  },

  updateMetadata(caller: string, nftId: bigint, metadata: string) {
    if (!this.isOracle(caller)) return { error: 106 };
    if (metadata === "") return { error: 107 };
    const nftKey = nftId.toString();
    const nft = this.nfts.get(nftKey);
    if (!nft) return { error: 101 };
    this.nfts.set(nftKey, { ...nft, metadata });
    return { value: true };
  },

  transfer(caller: string, nftId: bigint, sender: string, recipient: string) {
    if (this.paused) return { error: 103 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 104 };
    const nftKey = nftId.toString();
    const nft = this.nfts.get(nftKey);
    if (!nft) return { error: 101 };
    if (caller !== nft.owner && !this.approvedOperators.get(`${nftId}-${caller}`)) return { error: 102 };
    this.nfts.set(nftKey, { ...nft, owner: recipient });
    this.approvedOperators.delete(`${nftId}-${caller}`);
    return { value: true };
  },

  approveOperator(caller: string, nftId: bigint, operator: string) {
    const nftKey = nftId.toString();
    const nft = this.nfts.get(nftKey);
    if (!nft) return { error: 101 };
    if (caller !== nft.owner) return { error: 102 };
    this.approvedOperators.set(`${nftId}-${operator}`, true);
    return { value: true };
  },

  revokeOperator(caller: string, nftId: bigint, operator: string) {
    const nftKey = nftId.toString();
    const nft = this.nfts.get(nftKey);
    if (!nft) return { error: 101 };
    if (caller !== nft.owner) return { error: 102 };
    this.approvedOperators.delete(`${nftId}-${operator}`);
    return { value: true };
  },
};

describe("Player Asset NFT Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.oracle = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.totalNfts = 0n;
    mockContract.nfts = new Map();
    mockContract.playerMintCount = new Map();
    mockContract.approvedOperators = new Map();
  });

  it("should mint new NFT when called by admin", () => {
    const result = mockContract.mint(mockContract.admin, 1n, "ST2CY5...", "ipfs://stats1");
    expect(result).toEqual({ value: 1n });
    expect(mockContract.nfts.get("1")).toEqual({
      owner: "ST2CY5...",
      playerId: 1n,
      metadata: "ipfs://stats1",
    });
    expect(mockContract.playerMintCount.get("1")).toBe(1n);
  });

  it("should prevent minting by non-admin", () => {
    const result = mockContract.mint("ST2CY5...", 1n, "ST2CY5...", "ipfs://stats1");
    expect(result).toEqual({ error: 100 });
  });

  it("should prevent minting to zero address", () => {
    const result = mockContract.mint(mockContract.admin, 1n, "SP000000000000000000002Q6VF78", "ipfs://stats1");
    expect(result).toEqual({ error: 104 });
  });

  it("should prevent minting over max per player", () => {
    mockContract.playerMintCount.set("1", 100n);
    const result = mockContract.mint(mockContract.admin, 1n, "ST2CY5...", "ipfs://stats1");
    expect(result).toEqual({ error: 105 });
  });

  it("should update metadata when called by oracle", () => {
    mockContract.mint(mockContract.admin, 1n, "ST2CY5...", "ipfs://stats1");
    const result = mockContract.updateMetadata(mockContract.oracle, 1n, "ipfs://stats2");
    expect(result).toEqual({ value: true });
    expect(mockContract.nfts.get("1")?.metadata).toBe("ipfs://stats2");
  });

  it("should prevent metadata update by non-oracle", () => {
    mockContract.mint(mockContract.admin, 1n, "ST2CY5...", "ipfs://stats1");
    const result = mockContract.updateMetadata("ST2CY5...", 1n, "ipfs://stats2");
    expect(result).toEqual({ error: 106 });
  });

  it("should transfer NFT by owner", () => {
    mockContract.mint(mockContract.admin, 1n, "ST2CY5...", "ipfs://stats1");
    const result = mockContract.transfer("ST2CY5...", 1n, "ST2CY5...", "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.nfts.get("1")?.owner).toBe("ST3NB...");
  });

  it("should transfer NFT by approved operator", () => {
    mockContract.mint(mockContract.admin, 1n, "ST2CY5...", "ipfs://stats1");
    mockContract.approveOperator("ST2CY5...", 1n, "ST3NB...");
    const result = mockContract.transfer("ST3NB...", 1n, "ST2CY5...", "ST4JQ...");
    expect(result).toEqual({ value: true });
    expect(mockContract.nfts.get("1")?.owner).toBe("ST4JQ...");
  });

  it("should prevent transfer by unauthorized caller", () => {
    mockContract.mint(mockContract.admin, 1n, "ST2CY5...", "ipfs://stats1");
    const result = mockContract.transfer("ST3NB...", 1n, "ST2CY5...", "ST4JQ...");
    expect(result).toEqual({ error: 102 });
  });

  it("should approve operator", () => {
    mockContract.mint(mockContract.admin, 1n, "ST2CY5...", "ipfs://stats1");
    const result = mockContract.approveOperator("ST2CY5...", 1n, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.approvedOperators.get("1-ST3NB...")).toBe(true);
  });

  it("should revoke operator", () => {
    mockContract.mint(mockContract.admin, 1n, "ST2CY5...", "ipfs://stats1");
    mockContract.approveOperator("ST2CY5...", 1n, "ST3NB...");
    const result = mockContract.revokeOperator("ST2CY5...", 1n, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.approvedOperators.get("1-ST3NB...")).toBeUndefined();
  });

  it("should not allow actions when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    const mintResult = mockContract.mint(mockContract.admin, 1n, "ST2CY5...", "ipfs://stats1");
    const transferResult = mockContract.transfer("ST2CY5...", 1n, "ST2CY5...", "ST3NB...");
    expect(mintResult).toEqual({ error: 103 });
    expect(transferResult).toEqual({ error: 103 });
  });
});