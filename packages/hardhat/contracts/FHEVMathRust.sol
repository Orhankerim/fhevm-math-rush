// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEVMathRust
 * @dev Each user submits encrypted math results.
 * The contract keeps only the user's best (maximum) encrypted result.
 * Both the user and contract can decrypt their own data.
 */
contract FHEVMathRust is SepoliaConfig {
    // Store best encrypted result per user
    mapping(address => euint32) private _bestResult;
    mapping(address => bool) private _hasResult;

    /**
     * @notice Submit an encrypted math result.
     * @param resultEncrypted Encrypted score/result (e.g., number of correct answers)
     * @param proof Zero-knowledge proof for encrypted input
     */
    function submitResult(externalEuint32 resultEncrypted, bytes calldata proof) external {
        // Decrypt externally submitted result
        euint32 newResult = FHE.fromExternal(resultEncrypted, proof);

        // Allow user and contract to decrypt
        FHE.allow(newResult, msg.sender);
        FHE.allowThis(newResult);

        if (_hasResult[msg.sender]) {
            // Compare with current best result
            euint32 currentBest = _bestResult[msg.sender];

            // newBest = max(currentBest, newResult)
            euint32 newBest = FHE.select(FHE.gt(newResult, currentBest), newResult, currentBest);
            _bestResult[msg.sender] = newBest;
        } else {
            // First submission
            _bestResult[msg.sender] = newResult;
            _hasResult[msg.sender] = true;
        }
    }

    /**
     * @notice Get the best encrypted result of a user.
     * @param user The address whose best result to fetch.
     * @return Encrypted best result.
     */
    function getBestResult(address user) external view returns (euint32) {
        require(_hasResult[user], "No result found");
        return _bestResult[user];
    }

    /**
     * @notice Check if a user has submitted any result.
     * @param user The address to check.
     * @return True if the user has a stored result.
     */
    function hasResult(address user) external view returns (bool) {
        return _hasResult[user];
    }
}
