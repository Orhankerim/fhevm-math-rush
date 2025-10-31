// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEVMathRust
 * @dev Each player submits encrypted math scores.
 * The contract only keeps the player's best (maximum) encrypted score.
 * Both the player and the contract can decrypt their own data.
 */
contract FHEVMathRust is SepoliaConfig {
    // Encrypted best score per player
    mapping(address => euint32) private _topScore;
    mapping(address => bool) private _hasScore;

    /**
     * @notice Submit an encrypted score.
     * @param encryptedScore The encrypted math score
     * @param zkProof Zero-knowledge proof for encrypted input
     */
    function submitScore(externalEuint32 encryptedScore, bytes calldata zkProof) external {
        euint32 latestScore = FHE.fromExternal(encryptedScore, zkProof);

        FHE.allow(latestScore, msg.sender);
        FHE.allowThis(latestScore);

        if (_hasScore[msg.sender]) {
            euint32 prevTop = _topScore[msg.sender];
            euint32 betterScore = FHE.select(FHE.gt(latestScore, prevTop), latestScore, prevTop);

            _topScore[msg.sender] = betterScore;

            FHE.allow(_topScore[msg.sender], msg.sender);
            FHE.allowThis(_topScore[msg.sender]);
        } else {
            _topScore[msg.sender] = latestScore;
            _hasScore[msg.sender] = true;

            FHE.allow(_topScore[msg.sender], msg.sender);
            FHE.allowThis(_topScore[msg.sender]);
        }
    }

    /**
     * @notice Get the best encrypted score of a player.
     * @param player The address of the player.
     * @return Encrypted top score.
     */
    function getTopScore(address player) external view returns (euint32) {
        require(_hasScore[player], "No score found");
        return _topScore[player];
    }

    /**
     * @notice Check if a player has submitted any score.
     * @param player The address to check.
     * @return True if the player has a stored score.
     */
    function hasScore(address player) external view returns (bool) {
        return _hasScore[player];
    }
}
