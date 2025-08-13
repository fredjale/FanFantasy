# FanFantasy

A blockchain-powered decentralized fantasy sports platform that addresses centralization issues in traditional fantasy leagues, such as lack of true asset ownership, unfair platform fees, and opaque scoring. Fans own and trade player performance assets as NFTs, participate in community governance, and earn rewards transparently — fostering fair, user-driven ecosystems.

---

## Overview

FanFantasy consists of four main smart contracts that together form a decentralized, transparent, and community-owned fantasy sports experience:

1. **Player Asset NFT Contract** – Manages the creation, updating, and ownership of tokenized player performance stats.
2. **Fantasy League DAO Contract** – Enables community voting on league rules, disputes, and upgrades.
3. **Trading Marketplace Contract** – Facilitates peer-to-peer trading of player assets with built-in royalties.
4. **Rewards Pool Contract** – Automates scoring, reward distribution, and integration with real-world data oracles.

---

## Features

- **Tokenized player assets** that update with real-time performance stats  
- **DAO governance** for fan-voted league decisions and rule changes  
- **Decentralized marketplace** for trading assets without intermediaries  
- **Automated rewards** based on verifiable fantasy outcomes  
- **Transparent scoring** via oracle-fed sports data  
- **Anti-cheat mechanisms** through on-chain verification  
- **Community-driven leagues** where users own the ecosystem  

---

## Smart Contracts

### Player Asset NFT Contract
- Mint NFTs representing athletes with initial stats
- Update metadata dynamically via oracle inputs for performance tracking
- Transfer ownership and enforce scarcity limits

### Fantasy League DAO Contract
- Proposal creation and voting weighted by staked assets
- Execute approved changes on-chain (e.g., rule updates)
- Dispute resolution with quorum requirements

### Trading Marketplace Contract
- List, buy, and sell player NFTs with automated escrow
- Royalty splits to original minters or league treasury
- Price discovery through auctions and fixed listings

### Rewards Pool Contract
- Stake assets into fantasy pools for competitions
- Distribute winnings based on oracle-verified scores
- Integrate with external data feeds for match results

---

## Installation

1. Install [Clarinet CLI](https://docs.hiro.so/clarinet/getting-started)
2. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/fanfantasy.git
   ```
3. Run tests:
    ```bash
    npm test
    ```
4. Deploy contracts:
    ```bash
    clarinet deploy
    ```

## Usage

Each smart contract operates independently but integrates with others for a complete decentralized fantasy sports experience.
Refer to individual contract documentation for function calls, parameters, and usage examples.

## License

MIT License