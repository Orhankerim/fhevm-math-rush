import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHEVMathRust = await deploy("FHEVMathRust", {
    from: deployer,
    log: true,
  });

  console.log(`FHEVMathRust contract: `, deployedFHEVMathRust.address);
};
export default func;
func.id = "deploy_FHEVMathRust"; // id required to prevent reexecution
func.tags = ["FHEVMathRust"];
