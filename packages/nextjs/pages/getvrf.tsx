import React, { useEffect, useState } from "react";
import vrfConsumerAbi from "../abi/VRFv2DirectFundingConsumer.json";
import yahoAbi from "../abi/Yaho.json";
import yaruAbi from "../abi/Yaru.json";
import { ethers, getAddress } from "ethers";
import { MetaHeader } from "~~/components/MetaHeader";

// Yaho(Chiado), Yaru(Chiado), and Chainlink VRF(Goerli) contracts
const yahoAddress = getAddress("0x0e729b11661B3f1C1E829AAdF764D5C3295e1256");
const yaruAddress = getAddress("0x2EFf4B88Cfa00180409A5cF2f248CBF6Af4e22D6");
const vrfConsumerAddress = getAddress("0xa340bb99457D4E676824da9F20bD9df1684B1529");
// Arbitrary Message Bridge Addresses
const chiadoAmbAdapterAddress = getAddress("0x02EF808c1235EC235BdfEf9b5768527D86093711");
const goerliAmbAddress = getAddress("0x87A19d769D875964E9Cd41dDBfc397B2543764E6");

const goerliProvider = new ethers.JsonRpcProvider(
  "https://eth-goerli.g.alchemy.com/v2/2gREiFpRREa5fwK1vJYP33B6Gska7iHr",
);
const chiadoProvider = new ethers.JsonRpcProvider(
  "https://rpc.ankr.com/gnosis_testnet/1b9d82f3f0d792f0cf027af1dc0abfd2d1f4d45e8ef23e5997375a67f3b384dc",
);
const chiadoWallet = new ethers.Wallet("", chiadoProvider);

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
    // Log the initiation of the VRF request process
    console.log("Starting the process to get VRF...");
    setLoading(true); // Set loading state to true to indicate the process has started

    try {
      // Get the signer object from the provider to sign transactions
      // const signer = await chiadoProvider.getSigner();
      // console.log('Signer obtained:', signer);
      const signer = chiadoWallet;
      // Instantiate the Yaho contract with the signer to interact with it
      const yahoContract = new ethers.Contract(yahoAddress, yahoAbi.abi, signer);
      console.log("Yaho contract instantiated:", yahoContract);

      // Instantiate the Yaru contract with the signer to interact with it
      const yaruContract = new ethers.Contract(yaruAddress, yaruAbi.abi, signer);
      console.log("Yaru contract instantiated:", yaruContract);

      // Prepare the message to request a VRF
      const message = {
        toChainId: ethers.getBigInt(5),
        to: vrfConsumerAddress,
        data: vrfConsumerContract.interface.encodeFunctionData("requestRandomWords"),
      };
      console.log("Message prepared for dispatch:", message);

      // Dispatch the message through the Yaho contract on Chiado
      console.log("Dispatching messages with parameters:", [message], [chiadoAmbAdapterAddress], [goerliAmbAddress]);
      const dispatchTx = await yahoContract.dispatchMessagesToAdapters(
        [message],
        [chiadoAmbAdapterAddress],
        [goerliAmbAddress],
      );
      console.log("Dispatch transaction sent:", dispatchTx);

      // Wait for the dispatch transaction to be confirmed
      const dispatchReceipt = await dispatchTx.wait();
      console.log("Dispatch transaction confirmed:", dispatchReceipt);

      // Extract the messageId from the event logs of the dispatch transaction receipt
      const messageId = dispatchReceipt.events.find((event: any) => event.event === "MessageDispatched").args.messageId;
      console.log("Message ID extracted from event logs:", messageId);

      // Execute the message on the Goerli chain using the Yaru contract
      const executeTx = await yaruContract.executeMessages(
        [message],
        [messageId],
        [signer.address],
        [goerliAmbAddress],
      );
      console.log("Execute transaction sent:", executeTx);

      // Wait for the execute transaction to be confirmed
      const executeReceipt = await executeTx.wait();
      console.log("Execute transaction confirmed:", executeReceipt);

      // Start listening for the VRF response after executing the message
      listenForVRFResponse(messageId);

      // Update the requestId state for display purposes
      setRequestId(messageId);
      console.log("Request ID set to state:", messageId);
    } catch (error) {
      // Log any errors that occur during the process
      console.error("Error getting VRF:", error);
      alert("There was an error fetching the VRF.");
    } finally {
      // Set loading state to false to indicate the process has ended
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
        <p className="text-3xl mt-14">Get VRF</p>
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
