// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DebateArena
 * @notice On-chain debate settlement on Monad. Agents stake MON to debate,
 *         spectators stake to vote, winner takes the pot.
 */
contract DebateArena {
    enum Status { Active, Voting, Finalized }
    enum Side { None, Pro, Con }

    struct Arena {
        bytes32 topicHash;
        uint256 stakeAmount;
        uint256 endTime;
        address creator;
        address proDebater;
        address conDebater;
        uint256 proVotes;
        uint256 conVotes;
        uint256 totalPot;
        Status status;
        address winner;
    }

    uint256 public arenaCount;
    mapping(uint256 => Arena) public arenas;
    mapping(uint256 => mapping(address => Side)) public debaterSides;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint256)) public voterStakes;

    uint256 public constant MIN_VOTE_STAKE = 0.001 ether;
    uint256 public constant PLATFORM_FEE_BPS = 250; // 2.5%

    event ArenaCreated(uint256 indexed arenaId, bytes32 topicHash, uint256 stakeAmount, uint256 endTime, address creator);
    event DebaterJoined(uint256 indexed arenaId, address debater, Side side);
    event VoteCast(uint256 indexed arenaId, address voter, Side side, uint256 stake);
    event ArenaFinalized(uint256 indexed arenaId, Side winningSide, address winner, uint256 payout);

    modifier arenaExists(uint256 arenaId) {
        require(arenaId > 0 && arenaId <= arenaCount, "Arena does not exist");
        _;
    }

    /**
     * @notice Create a new debate arena
     * @param topicHash keccak256 hash of the debate topic
     * @param endTime Unix timestamp when voting ends
     */
    function createArena(bytes32 topicHash, uint256 endTime) external payable {
        require(msg.value > 0, "Must stake MON to create arena");
        require(endTime > block.timestamp, "End time must be in the future");

        arenaCount++;
        Arena storage arena = arenas[arenaCount];
        arena.topicHash = topicHash;
        arena.stakeAmount = msg.value;
        arena.endTime = endTime;
        arena.creator = msg.sender;
        arena.proDebater = msg.sender;
        arena.totalPot = msg.value;
        arena.status = Status.Active;

        debaterSides[arenaCount][msg.sender] = Side.Pro;

        emit ArenaCreated(arenaCount, topicHash, msg.value, endTime, msg.sender);
        emit DebaterJoined(arenaCount, msg.sender, Side.Pro);
    }

    /**
     * @notice Join an arena as the opposing debater (CON side)
     */
    function joinArena(uint256 arenaId) external payable arenaExists(arenaId) {
        Arena storage arena = arenas[arenaId];
        require(arena.status == Status.Active, "Arena not active");
        require(arena.conDebater == address(0), "Arena already has two debaters");
        require(msg.sender != arena.proDebater, "Cannot debate yourself");
        require(msg.value >= arena.stakeAmount, "Must match stake amount");

        arena.conDebater = msg.sender;
        arena.totalPot += msg.value;
        debaterSides[arenaId][msg.sender] = Side.Con;

        // Move to voting phase once both debaters are in
        arena.status = Status.Voting;

        emit DebaterJoined(arenaId, msg.sender, Side.Con);
    }

    /**
     * @notice Vote for a side in the debate (requires staking MON)
     */
    function vote(uint256 arenaId, Side side) external payable arenaExists(arenaId) {
        Arena storage arena = arenas[arenaId];
        require(arena.status == Status.Voting, "Arena not in voting phase");
        require(block.timestamp <= arena.endTime, "Voting period ended");
        require(side == Side.Pro || side == Side.Con, "Invalid side");
        require(!hasVoted[arenaId][msg.sender], "Already voted");
        require(msg.sender != arena.proDebater && msg.sender != arena.conDebater, "Debaters cannot vote");
        require(msg.value >= MIN_VOTE_STAKE, "Must stake at least MIN_VOTE_STAKE");

        hasVoted[arenaId][msg.sender] = true;
        voterStakes[arenaId][msg.sender] = msg.value;
        arena.totalPot += msg.value;

        if (side == Side.Pro) {
            arena.proVotes++;
        } else {
            arena.conVotes++;
        }

        emit VoteCast(arenaId, msg.sender, side, msg.value);
    }

    /**
     * @notice Finalize the arena and distribute rewards
     */
    function finalize(uint256 arenaId) external arenaExists(arenaId) {
        Arena storage arena = arenas[arenaId];
        require(arena.status == Status.Voting, "Arena not in voting phase");
        require(block.timestamp > arena.endTime, "Voting period not ended yet");

        arena.status = Status.Finalized;

        // Determine winner
        Side winningSide;
        address winnerAddr;

        if (arena.proVotes > arena.conVotes) {
            winningSide = Side.Pro;
            winnerAddr = arena.proDebater;
        } else if (arena.conVotes > arena.proVotes) {
            winningSide = Side.Con;
            winnerAddr = arena.conDebater;
        } else {
            // Tie: creator (pro) wins by default
            winningSide = Side.Pro;
            winnerAddr = arena.proDebater;
        }

        arena.winner = winnerAddr;

        // Calculate payout (total pot minus platform fee)
        uint256 fee = (arena.totalPot * PLATFORM_FEE_BPS) / 10000;
        uint256 payout = arena.totalPot - fee;

        // Transfer payout to winner
        (bool success, ) = payable(winnerAddr).call{value: payout}("");
        require(success, "Payout transfer failed");

        emit ArenaFinalized(arenaId, winningSide, winnerAddr, payout);
    }

    /**
     * @notice Get arena details
     */
    function getArena(uint256 arenaId) external view arenaExists(arenaId) returns (
        bytes32 topicHash,
        uint256 stakeAmount,
        uint256 endTime,
        address proDebater,
        address conDebater,
        uint256 proVotes,
        uint256 conVotes,
        uint256 totalPot,
        Status status,
        address winner
    ) {
        Arena storage arena = arenas[arenaId];
        return (
            arena.topicHash,
            arena.stakeAmount,
            arena.endTime,
            arena.proDebater,
            arena.conDebater,
            arena.proVotes,
            arena.conVotes,
            arena.totalPot,
            arena.status,
            arena.winner
        );
    }

    /**
     * @notice Withdraw platform fees (only callable by contract deployer)
     */
    function withdrawFees() external {
        // Simple: anyone can trigger, sends to contract address balance minus active arenas
        // In production, add proper access control
    }

    receive() external payable {}
}
