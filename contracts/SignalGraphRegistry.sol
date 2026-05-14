// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SignalGraphRegistry {
    struct BriefRecord {
        bytes32 briefHash;
        string storageUri;
        address creator;
        uint256 createdAt;
    }

    uint256 public nextBriefId;

    mapping(uint256 => BriefRecord) private records;

    event BriefRegistered(
        uint256 indexed briefId,
        address indexed creator,
        bytes32 briefHash,
        string storageUri
    );

    error EmptyStorageUri();
    error EmptyBriefHash();
    error BriefNotFound(uint256 briefId);

    function registerBrief(
        bytes32 briefHash,
        string calldata storageUri
    ) external returns (uint256 briefId) {
        if (briefHash == bytes32(0)) {
            revert EmptyBriefHash();
        }

        if (bytes(storageUri).length == 0) {
            revert EmptyStorageUri();
        }

        briefId = nextBriefId;
        records[briefId] = BriefRecord({
            briefHash: briefHash,
            storageUri: storageUri,
            creator: msg.sender,
            createdAt: block.timestamp
        });

        nextBriefId = briefId + 1;

        emit BriefRegistered(briefId, msg.sender, briefHash, storageUri);
    }

    function getBrief(uint256 briefId) external view returns (BriefRecord memory) {
        if (briefId >= nextBriefId) {
            revert BriefNotFound(briefId);
        }

        return records[briefId];
    }
}
