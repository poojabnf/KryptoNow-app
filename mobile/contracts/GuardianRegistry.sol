// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * GuardianRegistry.sol  v1.0.0
 * KryptoNow Social Recovery  on-chain guardian registry
 * Deploy to: ETH, Polygon, Arbitrum, Optimism, Base
 * Est. deploy gas: ~350,000
 */
contract GuardianRegistry {

    event GuardianAdded(address indexed smartAccount, address indexed guardian, string nickname, uint256 threshold, uint256 timestamp);
    event GuardianRemoved(address indexed smartAccount, address indexed guardian, uint256 timestamp);
    event RecoveryInitiated(address indexed smartAccount, address indexed newOwner, bytes32 indexed requestId, uint256 deadline, uint256 timestamp);
    event RecoverySigned(bytes32 indexed requestId, address indexed guardian, uint256 timestamp);
    event RecoveryExecuted(bytes32 indexed requestId, address indexed smartAccount, address indexed newOwner, uint256 timestamp);
    event RecoveryCancelled(bytes32 indexed requestId, address indexed smartAccount, uint256 timestamp);

    struct RecoveryRequest {
        address smartAccount;
        address newOwner;
        uint256 deadline;
        address[] signers;
        mapping(address => bool) hasSigned;
        bool executed;
        bool cancelled;
    }

    struct GuardianSet {
        address[] list;
        mapping(address => bool) isGuardian;
        mapping(address => string) nicknames;
        uint8 threshold;
    }

    mapping(address => GuardianSet)    private guardianSets;
    mapping(bytes32 => RecoveryRequest) private recoveryRequests;
    mapping(address => uint256)         public  nonces;

    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant  RECOVERY_TYPEHASH = keccak256(
        "RecoverAccount(address smartAccount,address newOwner,uint256 deadline,uint256 nonce)"
    );

    constructor() {
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("KryptoNow Social Recovery"),
            keccak256("1"),
            block.chainid,
            address(this)
        ));
    }

    //  Guardian management 

    function addGuardian(address guardian, string calldata nickname, uint8 newThreshold) external {
        require(guardian != address(0) && guardian != msg.sender, "Invalid guardian");
        require(bytes(nickname).length > 0, "Empty nickname");
        GuardianSet storage gs = guardianSets[msg.sender];
        require(!gs.isGuardian[guardian], "Already guardian");
        require(gs.list.length < 5, "Max 5 guardians");
        gs.list.push(guardian);
        gs.isGuardian[guardian] = true;
        gs.nicknames[guardian]  = nickname;
        gs.threshold            = newThreshold;
        emit GuardianAdded(msg.sender, guardian, nickname, newThreshold, block.timestamp);
    }

    function removeGuardian(address guardian, uint8 newThreshold) external {
        GuardianSet storage gs = guardianSets[msg.sender];
        require(gs.isGuardian[guardian], "Not guardian");
        gs.isGuardian[guardian] = false;
        for (uint i = 0; i < gs.list.length; i++) {
            if (gs.list[i] == guardian) {
                gs.list[i] = gs.list[gs.list.length - 1];
                gs.list.pop();
                break;
            }
        }
        gs.threshold = newThreshold;
        emit GuardianRemoved(msg.sender, guardian, block.timestamp);
    }

    //  Recovery flow 

    function initiateRecovery(address smartAccount, address newOwner, uint256 deadline) external returns (bytes32 requestId) {
        require(deadline > block.timestamp, "Deadline past");
        require(guardianSets[smartAccount].isGuardian[msg.sender], "Not guardian");
        requestId = keccak256(abi.encodePacked(smartAccount, newOwner, deadline, nonces[smartAccount]++));
        RecoveryRequest storage req = recoveryRequests[requestId];
        req.smartAccount = smartAccount;
        req.newOwner     = newOwner;
        req.deadline     = deadline;
        emit RecoveryInitiated(smartAccount, newOwner, requestId, deadline, block.timestamp);
    }

    function signRecovery(bytes32 requestId, bytes calldata sig) external {
        RecoveryRequest storage req = recoveryRequests[requestId];
        require(req.smartAccount != address(0) && !req.executed && !req.cancelled, "Invalid request");
        require(block.timestamp < req.deadline, "Expired");
        GuardianSet storage gs = guardianSets[req.smartAccount];
        require(gs.isGuardian[msg.sender] && !req.hasSigned[msg.sender], "Cannot sign");
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR,
            keccak256(abi.encode(RECOVERY_TYPEHASH, req.smartAccount, req.newOwner, req.deadline, nonces[req.smartAccount] - 1))
        ));
        require(_recover(digest, sig) == msg.sender, "Bad sig");
        req.hasSigned[msg.sender] = true;
        req.signers.push(msg.sender);
        emit RecoverySigned(requestId, msg.sender, block.timestamp);
    }

    function executeRecovery(bytes32 requestId) external {
        RecoveryRequest storage req = recoveryRequests[requestId];
        require(req.smartAccount != address(0) && !req.executed && !req.cancelled, "Invalid");
        require(block.timestamp < req.deadline, "Expired");
        GuardianSet storage gs = guardianSets[req.smartAccount];
        require(req.signers.length >= gs.threshold, "Insufficient sigs");
        req.executed = true;
        (bool ok,) = req.smartAccount.call(abi.encodeWithSelector(0xf2fde38b, req.newOwner));
        require(ok, "transferOwnership failed");
        emit RecoveryExecuted(requestId, req.smartAccount, req.newOwner, block.timestamp);
    }

    function cancelRecovery(bytes32 requestId) external {
        RecoveryRequest storage req = recoveryRequests[requestId];
        require(req.smartAccount == msg.sender && !req.executed, "Cannot cancel");
        req.cancelled = true;
        emit RecoveryCancelled(requestId, req.smartAccount, block.timestamp);
    }

    //  Views 

    function getGuardians(address smartAccount) external view returns (address[] memory, uint8) {
        GuardianSet storage gs = guardianSets[smartAccount];
        return (gs.list, gs.threshold);
    }

    function isGuardian(address smartAccount, address guardian) external view returns (bool) {
        return guardianSets[smartAccount].isGuardian[guardian];
    }

    function getSigners(bytes32 requestId) external view returns (address[] memory) {
        return recoveryRequests[requestId].signers;
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Bad sig len");
        bytes32 r; bytes32 s; uint8 v;
        assembly { r := calldataload(sig.offset) s := calldataload(add(sig.offset, 32)) v := byte(0, calldataload(add(sig.offset, 64))) }
        return ecrecover(digest, v, r, s);
    }
}
