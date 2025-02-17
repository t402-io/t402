import { botWallet, facilitatorWallet } from "./src/shared/wallet";
import { createPayment } from "./src/client/client";
import { abi } from "./src/shared/erc20PermitABI";
import {
  getPermitNonce,
  getUsdcAddressForChain,
  getVersion,
} from "./src/shared/usdc";
import { signAuthorization, createNonce } from "./src/shared/permit";

export async function main() {
  // TODO: probably should store stuff in a db here, but the txs can be recovered from chain if we must

  const fwallet = facilitatorWallet;
  const cwallet = botWallet;

  const usdcAddress = getUsdcAddressForChain(fwallet.chain!.id);
  console.log({ usdcAddress });

  const amount = BigInt(0.1 * 10 ** 6); // 0.10 USDC
  const version = await getVersion(cwallet);
  const nonce = createNonce();

  console.log({ nonce });

  const authRequest = {
    from: cwallet.account!.address,
    to: fwallet.account!.address,
    value: amount,
    validAfter: BigInt(Math.floor(Date.now() / 1000) - 10),
    validBefore: BigInt(Math.floor(Date.now() / 1000) + 6000000),
    nonce: nonce,
    chainId: cwallet.chain!.id,
    version: version,
    usdcAddress: usdcAddress,
  };

  const { signature } = await signAuthorization(cwallet, authRequest);
  console.log({ signature });

  const tx = await fwallet.writeContract({
    address: usdcAddress,
    abi,
    functionName: "transferWithAuthorization",
    args: [
      authRequest.from,
      authRequest.to,
      authRequest.value / BigInt(2),
      authRequest.validAfter,
      authRequest.validBefore,
      authRequest.nonce,
      signature,
    ],
  });

  const receipt = await fwallet.waitForTransactionReceipt({ hash: tx });
  console.log({ receipt });
}

await main();
