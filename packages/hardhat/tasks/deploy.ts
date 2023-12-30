import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("deploy:VRFv2DirectFundingConsumer")
  .addParam("owner", "address to set as the owner of this contract")
  .setAction(async function (taskArguments, hre: HardhatRuntimeEnvironment) {
    console.log("Deploying VRFv2DirectFundingConsumer...");
    const signers = await hre.ethers.getSigners();
    const vrfConsumerFactory = await hre.ethers.getContractFactory("VRFv2DirectFundingConsumer");
    const constructorArguments: any[] = []; // No constructor arguments for this contract
    const vrfConsumer = await vrfConsumerFactory.connect(signers[0]).deploy(...constructorArguments);
    await vrfConsumer.deployed();
    console.log("VRFv2DirectFundingConsumer deployed to:", vrfConsumer.address);
  });
