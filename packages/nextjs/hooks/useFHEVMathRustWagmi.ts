"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import {
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

export const useFHEVMathRustWagmi = (parameters: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = parameters;
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;

  const { data: fheVMathRust } = useDeployedContractInfo({
    contractName: "FHEVMathRust",
    chainId: allowedChainId,
  });

  type FHEVMathRustInfo = Contract<"FHEVMathRust"> & { chainId?: number };

  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const hasContract = Boolean(fheVMathRust?.address && fheVMathRust?.abi);
  const hasSigner = Boolean(ethersSigner);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(fheVMathRust!.address, (fheVMathRust as FHEVMathRustInfo).abi, providerOrSigner);
  };

  const [bestResult, setBestResult] = useState<any>();

  const fetchBestScore = useCallback(async () => {
    if (!hasContract || !accounts?.[0]) return;
    try {
      const readContract = getContract("read");
      if (!readContract) return;
      const res = await readContract.getTopScore(accounts[0]);
      setBestResult({ handle: res, contractAddress: fheVMathRust!.address });
    } catch (err) {
      console.warn("fetchBestScore failed:", err);
    }
  }, [hasContract, fheVMathRust?.address, accounts]);

  useEffect(() => {
    fetchBestScore();
  }, [fetchBestScore]);

  // FHE decrypt
  const {
    decrypt,
    canDecrypt,
    isDecrypting,
    message: decMsg,
    results,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests: bestResult ? [bestResult] : undefined,
  });

  useEffect(() => {
    if (decMsg) setMessage(decMsg);
  }, [decMsg]);

  const decryptResult = decrypt;

  // FHE encrypt
  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: fheVMathRust?.address,
  });

  const canSubmit = useMemo(
    () => Boolean(hasContract && instance && hasSigner && !isProcessing),
    [hasContract, instance, hasSigner, isProcessing],
  );

  const getEncryptionMethodFor = (functionName: "submitScore") => {
    const functionAbi = fheVMathRust?.abi.find(item => item.type === "function" && item.name === functionName);
    if (!functionAbi) {
      return { method: undefined as string | undefined, error: `Function ABI not found for ${functionName}` };
    }
    if (!functionAbi.inputs || functionAbi.inputs.length === 0) {
      return { method: undefined as string | undefined, error: `No inputs found for ${functionName}` };
    }
    const firstInput = functionAbi.inputs[0]!;
    return { method: getEncryptionMethod(firstInput.internalType), error: undefined };
  };

  // Gửi điểm mới (nếu cao hơn thì lưu)
  const submitScore = useCallback(
    async (score: number) => {
      if (isProcessing || !canSubmit) return;
      setIsProcessing(true);
      setMessage(`Submitting score (${score})...`);
      try {
        const { method, error } = getEncryptionMethodFor("submitScore");
        if (!method) return setMessage(error ?? "Encryption method not found");
        setMessage(`Encrypting with ${method}...`);
        const enc = await encryptWith(builder => {
          (builder as any)[method](score);
        });
        if (!enc) return setMessage("Encryption failed");
        const writeContract = getContract("write");
        if (!writeContract) return setMessage("Contract info or signer not available");
        const params = buildParamsFromAbi(enc, [...fheVMathRust!.abi] as any[], "submitScore");
        const tx = await writeContract.submitScore(...params, { gasLimit: 300_000 });
        setMessage("Waiting for transaction...");
        await tx.wait();
        setMessage(`Score (${score}) submitted!`);
        await fetchBestScore();
      } catch (e) {
        setMessage(`submitScore() failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canSubmit, encryptWith, getContract, fetchBestScore, fheVMathRust?.abi],
  );

  useEffect(() => {
    setMessage("");
  }, [accounts, chainId]);

  return {
    contractAddress: fheVMathRust?.address,
    canDecrypt,
    decryptResult,
    submitScore,
    fetchBestScore,
    bestResult,
    results,
    isDecrypting,
    isProcessing,
    canSubmit,
    chainId,
    accounts,
    isConnected,
    ethersSigner,
    message,
  };
};
