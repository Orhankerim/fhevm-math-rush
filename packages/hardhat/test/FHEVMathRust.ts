import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FHEVMathRust, FHEVMathRust__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEVMathRust")) as FHEVMathRust__factory;
  const fheVMathRustContract = (await factory.deploy()) as FHEVMathRust;
  const fheVMathRustContractAddress = await fheVMathRustContract.getAddress();

  return { fheVMathRustContract, fheVMathRustContractAddress };
}

describe("FHEVMathRust", function () {
  let signers: Signers;
  let fheVMathRustContract: FHEVMathRust;
  let fheVMathRustContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ fheVMathRustContract, fheVMathRustContractAddress } = await deployFixture());
  });

  it("should revert if getting score before submission", async function () {
    await expect(fheVMathRustContract.getTopScore(signers.alice.address)).to.be.revertedWith("No score found");
  });

  it("should allow first-time score submission", async function () {
    const clearScore = 42;

    const encrypted = await fhevm
      .createEncryptedInput(fheVMathRustContractAddress, signers.alice.address)
      .add32(clearScore)
      .encrypt();

    await fheVMathRustContract.connect(signers.alice).submitScore(encrypted.handles[0], encrypted.inputProof);

    const encryptedStored = await fheVMathRustContract.getTopScore(signers.alice.address);
    const clearStored = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedStored,
      fheVMathRustContractAddress,
      signers.alice,
    );

    expect(clearStored).to.eq(clearScore);
  });

  it("should replace score only if higher", async function () {
    const lowScore = 30;
    const highScore = 99;

    const encryptedLow = await fhevm
      .createEncryptedInput(fheVMathRustContractAddress, signers.alice.address)
      .add32(lowScore)
      .encrypt();

    await fheVMathRustContract.connect(signers.alice).submitScore(encryptedLow.handles[0], encryptedLow.inputProof);

    const encryptedHigh = await fhevm
      .createEncryptedInput(fheVMathRustContractAddress, signers.alice.address)
      .add32(highScore)
      .encrypt();

    await fheVMathRustContract.connect(signers.alice).submitScore(encryptedHigh.handles[0], encryptedHigh.inputProof);

    const encryptedStored = await fheVMathRustContract.getTopScore(signers.alice.address);
    const clearStored = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedStored,
      fheVMathRustContractAddress,
      signers.alice,
    );

    expect(clearStored).to.eq(highScore);
  });

  it("should keep old score if new score is lower", async function () {
    const firstScore = 88;
    const lowerScore = 40;

    const encryptedFirst = await fhevm
      .createEncryptedInput(fheVMathRustContractAddress, signers.alice.address)
      .add32(firstScore)
      .encrypt();

    await fheVMathRustContract.connect(signers.alice).submitScore(encryptedFirst.handles[0], encryptedFirst.inputProof);

    const encryptedLow = await fhevm
      .createEncryptedInput(fheVMathRustContractAddress, signers.alice.address)
      .add32(lowerScore)
      .encrypt();

    await fheVMathRustContract.connect(signers.alice).submitScore(encryptedLow.handles[0], encryptedLow.inputProof);

    const encryptedStored = await fheVMathRustContract.getTopScore(signers.alice.address);
    const clearStored = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedStored,
      fheVMathRustContractAddress,
      signers.alice,
    );

    expect(clearStored).to.eq(firstScore);
  });

  it("should isolate scores per player", async function () {
    const aliceScore = 55;
    const bobScore = 77;

    const encryptedAlice = await fhevm
      .createEncryptedInput(fheVMathRustContractAddress, signers.alice.address)
      .add32(aliceScore)
      .encrypt();

    const encryptedBob = await fhevm
      .createEncryptedInput(fheVMathRustContractAddress, signers.bob.address)
      .add32(bobScore)
      .encrypt();

    await fheVMathRustContract.connect(signers.alice).submitScore(encryptedAlice.handles[0], encryptedAlice.inputProof);
    await fheVMathRustContract.connect(signers.bob).submitScore(encryptedBob.handles[0], encryptedBob.inputProof);

    const encAliceStored = await fheVMathRustContract.getTopScore(signers.alice.address);
    const encBobStored = await fheVMathRustContract.getTopScore(signers.bob.address);

    const decAlice = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encAliceStored,
      fheVMathRustContractAddress,
      signers.alice,
    );

    const decBob = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encBobStored,
      fheVMathRustContractAddress,
      signers.bob,
    );

    expect(decAlice).to.eq(aliceScore);
    expect(decBob).to.eq(bobScore);
  });

  it("should correctly report hasScore()", async function () {
    const player = signers.alice;

    expect(await fheVMathRustContract.hasScore(player.address)).to.be.false;

    const encryptedScore = await fhevm
      .createEncryptedInput(fheVMathRustContractAddress, player.address)
      .add32(10)
      .encrypt();

    await fheVMathRustContract.connect(player).submitScore(encryptedScore.handles[0], encryptedScore.inputProof);

    expect(await fheVMathRustContract.hasScore(player.address)).to.be.true;
  });
});
