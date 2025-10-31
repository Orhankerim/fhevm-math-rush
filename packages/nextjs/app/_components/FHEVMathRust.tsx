"use client";

import { useEffect, useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import confetti from "canvas-confetti";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFHEVMathRustWagmi } from "~~/hooks/useFHEVMathRustWagmi";

export const FHEVMathRust = () => {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;

  const provider = useMemo(
    () => (typeof window !== "undefined" ? (window as any).ethereum : undefined),
    []
  );

  const initialMockChains = {
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  };

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const fheGame = useFHEVMathRustWagmi({ instance: fhevmInstance, initialMockChains });

  // -----------------------------
  // Gameplay state
  // -----------------------------
  const [questions, setQuestions] = useState<
    { a: number; b: number; options: number[]; correct: number }[]
  >([]);
  const [selected, setSelected] = useState<number[]>(Array(5).fill(-1));
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // -----------------------------
  // Generate 5 random addition questions
  // -----------------------------
  const generateQuestions = () => {
    const qs = Array.from({ length: 5 }).map(() => {
      const a = Math.floor(Math.random() * 90 + 10);
      const b = Math.floor(Math.random() * 90 + 10);
      const correct = a + b;
      const options = new Set<number>([correct]);
      while (options.size < 4) {
        const fake = correct + Math.floor(Math.random() * 10 - 5);
        if (fake !== correct && fake > 0) options.add(fake);
      }
      const shuffled = Array.from(options).sort(() => Math.random() - 0.5);
      return { a, b, options: shuffled, correct };
    });
    setQuestions(qs);
    setSelected(Array(5).fill(-1));
    setGameOver(false);
    setScore(0);
  };

  // -----------------------------
  // Start game
  // -----------------------------
  const startGame = () => {
    generateQuestions();
    setGameStarted(true);
    setTimeLeft(10);
  };

  // -----------------------------
  // Countdown timer
  // -----------------------------
  useEffect(() => {
    if (!gameStarted || timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [gameStarted, timeLeft]);

  // -----------------------------
  // Handle game end
  // -----------------------------
  useEffect(() => {
    if (gameStarted && timeLeft === 0) {
      setGameOver(true);
      setGameStarted(false);

      let correctCount = 0;
      questions.forEach((q, i) => {
        if (q.options[selected[i]] === q.correct) correctCount++;
      });
      setScore(correctCount);

      // 🎆 Fire confetti if perfect score
      if (correctCount === questions.length) {
        const duration = 3 * 1000;
        const end = Date.now() + duration;

        (function frame() {
          confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
          });
          confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        })();
      }
    }
  }, [timeLeft, gameStarted, selected, questions]);

  // -----------------------------
  // User actions
  // -----------------------------
  const handleSelect = (qIndex: number, optIndex: number) => {
    if (!gameStarted || timeLeft === 0) return;
    const updated = [...selected];
    updated[qIndex] = optIndex;
    setSelected(updated);
  };

  const handleSubmitScore = async () => {
    if (score >= 0 && fheGame.canSubmit) {
      await fheGame.submitScore(score);
      await fheGame.fetchBestScore();
    }
  };

  const handleDecrypt = async () => {
    if (!fheGame.canDecrypt || fheGame.isDecrypting) return;
    try {
      await fheGame.decryptResult();
    } catch {
      // ignore errors silently
    }
  };

  // -----------------------------
  // Wallet not connected
  // -----------------------------
  if (!isConnected) {
    return (
      <div className="h-[calc(100vh-100px)] flex w-full items-center justify-center bg-gradient-to-br from-blue-900 to-black text-white relative overflow-hidden">
        {/* Glowing background lights */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-700" />
        </div>

        <motion.div
          className="relative z-10 backdrop-blur-lg bg-white/10 border border-white/20 rounded-3xl p-12 text-center shadow-2xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="text-6xl mb-4 animate-bounce">🧮</div>
          <h2 className="text-4xl font-extrabold mb-3">Connect Your Wallet</h2>
          <p className="text-gray-300 mb-6">Play the FHE Math Challenge securely on-chain.</p>
          <RainbowKitCustomConnectButton />
        </motion.div>
      </div>
    );
  }

  // -----------------------------
  // Game UI
  // -----------------------------
  return (
    <div className="relative w-full overflow-scroll text-gray-100">
      {/* Background animation */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/3 left-1/4 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
        />
        <motion.div
          className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl"
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
        />
        <motion.div
          className="absolute top-2/3 right-1/3 w-64 h-64 bg-cyan-300/10 rounded-full blur-3xl"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
        />
      </div>

      {/* Main game panel */}
      <motion.div className="relative z-10 max-w-6xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex flex-col gap-6">
          {/* ---------------- Game Panel ---------------- */}
          <motion.div
            className="bg-white/10 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-8 shadow-2xl"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <h1 className="text-3xl font-extrabold mb-4 text-blue-400 flex items-center gap-2">
              🧮 FHE Math Challenge
            </h1>
            <p className="text-gray-300 mb-6">
              Solve 5 quick addition problems in 10 seconds!
            </p>

            {/* Start button */}
            {!gameStarted && !gameOver && (
              <button
                onClick={startGame}
                className="w-full px-4 py-3 rounded-lg bg-blue-500 text-black font-semibold hover:bg-blue-400 transition"
              >
                🚀 Start Game
              </button>
            )}

            {/* Questions */}
            {gameStarted && (
              <>
                <div className="flex justify-between mb-4">
                  <span>⏰ Time Left: {timeLeft}s</span>
                </div>
                <div className="space-y-4">
                  {questions.map((q, i) => (
                    <div key={i} className="bg-white/10 border border-white/20 rounded-xl p-4">
                      <div className="text-lg font-mono mb-3 text-blue-300">
                        {i + 1}. {q.a} + {q.b} = ?
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {q.options.map((opt, j) => {
                          const isSelected = selected[i] === j;
                          const isDisabled = !gameStarted || timeLeft === 0;
                          return (
                            <button
                              key={j}
                              disabled={isDisabled}
                              onClick={() => handleSelect(i, j)}
                              className={`px-3 py-2 rounded-lg border transition font-semibold ${
                                isSelected
                                  ? "bg-yellow-400 text-black border-yellow-300"
                                  : "bg-blue-950 border-blue-800 hover:bg-blue-800"
                              } ${isDisabled ? "opacity-70 cursor-not-allowed" : ""}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ---------------- Game Over Section ---------------- */}
            {gameOver && (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-3xl font-bold text-yellow-300 mb-2">
                    🎯 You got {score}/{questions.length} correct!
                  </h2>
                  <p className="text-gray-300 text-lg">
                    Accuracy: {((score / questions.length) * 100).toFixed(0)}%
                  </p>

                  {score === questions.length && (
                    <motion.p
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.2, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="text-4xl font-extrabold text-green-400 mt-4"
                    >
                      🏆 Perfect! You nailed it 100%!
                    </motion.p>
                  )}
                </div>

                <div className="flex justify-center gap-4">
                  <button
                    onClick={handleSubmitScore}
                    disabled={!fheGame.canSubmit || fheGame.isProcessing}
                    className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition disabled:opacity-60"
                  >
                    🏁 Submit Score
                  </button>

                  <button
                    onClick={startGame}
                    className="px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-400 transition"
                  >
                    🔁 Play Again
                  </button>
                </div>
              </>
            )}

            {/* ---------------- Message Panel ---------------- */}
            {fheGame.message && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-4 shadow-inner text-blue-300"
              >
                <h3 className="font-bold mb-2">💬 Message</h3>
                <p>{fheGame.message}</p>
              </motion.div>
            )}
          </motion.div>

          {/* ---------------- Status + Best Score ---------------- */}
          <motion.div
            className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-lg"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <h3 className="text-xl font-semibold mb-4 text-blue-300 border-b border-blue-700 pb-2">
              ⚙️ FHEVM Status
            </h3>

            <StatusRow label="Instance" value={fhevmInstance ? "✅ Connected" : "❌ None"} />
            <StatusRow label="Chain ID" value={chainId ?? "Unknown"} />
            <StatusRow label="Status" value={fhevmStatus || "—"} />
            <StatusRow label="Error" value={fhevmError ?? "No errors"} />

            {fheGame.bestResult && (
              <div className="mt-6">
                <h4 className="text-lg font-semibold mb-3 text-yellow-300 border-b border-yellow-600 pb-1">
                  🏆 Best Score
                </h4>

                {fheGame.bestResult ? (
                  <div className="p-4 bg-blue-900/40 border border-blue-700/50 rounded-2xl text-center mb-4">
                    <p className="text-4xl font-bold text-yellow-300">
                      {fheGame.results?.[fheGame.bestResult?.handle] ?? "🔒 Encrypted"}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400 italic mb-4">
                    No score yet — play your first round!
                  </p>
                )}

                <button
                  onClick={handleDecrypt}
                  disabled={!fheGame.canDecrypt || fheGame.isDecrypting || !fheGame.bestResult}
                  className={`w-full px-4 py-3 rounded-lg bg-blue-500 text-black font-semibold hover:bg-blue-400 transition ${
                    fheGame.isDecrypting || !fheGame.bestResult ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  🔓 {fheGame.isDecrypting ? "Decrypting..." : "Decrypt Best Score"}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

/* ---------------- Helper Component ---------------- */
function StatusRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between items-center bg-white/10 border border-white/20 rounded-xl px-4 py-2 mb-2">
      <span className="text-gray-300">{label}</span>
      <span className="font-mono text-sm text-blue-400">{String(value)}</span>
    </div>
  );
}
