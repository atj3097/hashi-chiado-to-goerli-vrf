import React, { useEffect, useState } from "react";
import ambAbi from "../abi/Amb.json";
import ambHelperAbi from "../abi/AmbHelper.json";
import vrfConsumerAbi from "../abi/VRFv2DirectFundingConsumer.json";
import yahoAbi from "../abi/Yaho.json";
import yaruAbi from "../abi/Yaru.json";
import { AbiCoder, ethers, getAddress } from "ethers";
import { MetaHeader } from "~~/components/MetaHeader";

// Yaho(Chiado), Yaru(Goerli), and Chainlink VRF(Goerli) contracts
const yahoAddress = getAddress("0x0e729b11661B3f1C1E829AAdF764D5C3295e1256");
const yaruAddress = getAddress("0x2EFf4B88Cfa00180409A5cF2f248CBF6Af4e22D6"); // needs to be goerli version still is chiado
const vrfConsumerAddress = getAddress("0xa340bb99457D4E676824da9F20bD9df1684B1529");
// Arbitrary Message Bridge Addresses
const chiadoAmbAdapterAddress = getAddress("0x02EF808c1235EC235BdfEf9b5768527D86093711");
const ambHelperAddress = getAddress("0xEd0dC0AA8A61c3Ac912072f50c4c5bd830d79E36");
const goerliAmbAddress = getAddress("0x87A19d769D875964E9Cd41dDBfc397B2543764E6");

const goerliProvider = new ethers.JsonRpcProvider(
  "https://eth-goerli.g.alchemy.com/v2/2gREiFpRREa5fwK1vJYP33B6Gska7iHr",
);
const chiadoProvider = new ethers.JsonRpcProvider(
  "https://rpc.ankr.com/gnosis_testnet/1b9d82f3f0d792f0cf027af1dc0abfd2d1f4d45e8ef23e5997375a67f3b384dc",
);
const chiadoWallet = new ethers.Wallet(
  "494082f501c5289288401d48770a7ff35372d974e8d6dc36fc47c83fc5533106",
  chiadoProvider,
);

const GetVRF = () => {
  const [vrf, setVrf] = useState("");
  const [requestId, setRequestId] = useState("");
  const [loading, setLoading] = useState(false);

  // Function to listen for the Chainlink VRF response event
  const vrfConsumerContract = new ethers.Contract(vrfConsumerAddress, vrfConsumerAbi.abi, goerliProvider);
  const listenForVRFResponse = async (requestId: string) => {
    // Log the start of listening for the VRF response
    console.log("Listening for VRF response with requestId:", requestId);

    // Create a filter for the 'RequestFulfilled' event that matches the provided requestId
    const filter = vrfConsumerContract.filters.RequestFulfilled(requestId);

    // Listen for the 'RequestFulfilled' event based on the filter
    vrfConsumerContract.on(filter, (requestId, randomWords, payment) => {
      // Log the VRF response details when the event is received
      console.log(`VRF Response received. Request ID: ${requestId}, Random Words: ${randomWords}, Payment: ${payment}`);

      // Set the received random words to the state
      setVrf(randomWords.join(", "));
      console.log("VRF set to state:", randomWords.join(", "));

      // Remove all listeners for the 'RequestFulfilled' event to avoid memory leaks
      vrfConsumerContract.removeAllListeners(filter);
      console.log("Removed all listeners for VRF response.");
    });
  };

  const getVRF = async () => {
    console.log("Starting the process to get VRF...");
    setLoading(true);

    try {
      const signer = chiadoWallet;
      const yahoContract = new ethers.Contract(yahoAddress, yahoAbi.abi, signer);
      const yaruContract = new ethers.Contract(yaruAddress, yaruAbi.abi, signer);
      const vrfConsumerContract = new ethers.Contract(vrfConsumerAddress, vrfConsumerAbi.abi, goerliProvider);
      const ambHelperContract = new ethers.Contract(ambHelperAddress, ambHelperAbi, goerliProvider);
      const ambContractOnGoerli = new ethers.Contract(goerliAmbAddress, ambAbi, goerliProvider);

      const message = {
        toChainId: ethers.toBigInt(5),
        to: vrfConsumerAddress,
        data: vrfConsumerContract.interface.encodeFunctionData("requestRandomWords"),
      };

      // Step 1: Dispatch the message
      console.log("Dispatching message...");
      const dispatchTx = await yahoContract.dispatchMessagesToAdapters(
        [message],
        [chiadoAmbAdapterAddress],
        [goerliAmbAddress],
      );
      await dispatchTx.wait();
      console.log("Message dispatched.", dispatchTx);

      // Step 2: Get the signature
      console.log("Getting signature...");
      const coder = AbiCoder.defaultAbiCoder();
      const encodedData = coder.encode(["address", "bytes"], [vrfConsumerAddress, message.data]);
      console.log("Encoded data:", encodedData);
      const signature = await ambHelperContract.getSignature(encodedData);
      console.log("Signature obtained.", signature);

      // Step 3: Execute the signature
      console.log("Executing signature...");
      const executeSignatureTx = await ambContractOnGoerli.executeSignature(encodedData, signature);
      const executeSignatureReceipt = await executeSignatureTx.wait();
      console.log("Signature executed.");

      // Step 4: Extract the messageId from the event logs
      console.log("Extracting messageId...");
      const messageId = executeSignatureReceipt.events.find((event: any) => event.event === "MessageDispatched").args
        .messageId;
      console.log("MessageId extracted: ", messageId);

      // Step 5: Execute the message
      console.log("Executing message...");
      const executeTx = await yaruContract.executeMessages(
        [message],
        [messageId],
        [signer.address],
        [goerliAmbAddress],
      );
      await executeTx.wait();
      console.log("Message executed.");

      // Step 6: Listen for the VRF response
      console.log("Listening for VRF response...");
      listenForVRFResponse(messageId);
      console.log("Listening for VRF response started.");

      setRequestId(messageId);
      console.log("Request ID set to state:", messageId);
    } catch (error) {
      console.error("Error getting VRF:", error);
      alert("There was an error fetching the VRF.");
    } finally {
      setLoading(false);
      console.log("Set loading to false");
    }
  };

  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      const vrfConsumerContract = new ethers.Contract(vrfConsumerAddress, vrfConsumerAbi.abi, goerliProvider);
      vrfConsumerContract.removeAllListeners();
    };
  }, [goerliProvider]);

  return (
    <>
      <MetaHeader
        title="Crosschain Request Chainlink VRF"
        description="From Gnosis's Testnet Chiado chain 🟢✨, you request a Chainlink VRF and listen for the response on Goerli chain."
      />
      <div className="flex flex-col gap-y-6 lg:gap-y-8 py-8 lg:py-12 justify-center items-center">
        <p className="text-3xl mt-14"> Use Hashi to request a Chainlink VRF from Goerli on Chiado </p>
        <p className="text-3m mt-2"> Open the Chrome console to see the magic ! </p>
        <p className="text-3xl mt-7">Tap for a VRF</p>
        <button
          className={`btn btn-secondary btn-lg font-thin ${loading ? "loading" : ""} bg-base-100`}
          onClick={getVRF}
          disabled={loading}
        >
          {loading ? "Requesting..." : "Get VRF"}
        </button>
        {requestId && <p className="text-3xl mt-14">Request ID: {requestId}</p>}
        {vrf && <p className="text-3xl mt-14">VRF: {vrf}</p>}
      </div>
    </>
  );
};

export default GetVRF;
