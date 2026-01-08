import { useEvmAddress, useIsSignedIn } from "@coinbase/cdp-hooks";
import { useState } from "react";
import { DiscoveryModal } from "../DiscoveryModal";
import { Dialog, Flex } from "@radix-ui/themes";

import { Button } from "../Button";
import { SessionSpendingTracker } from "../SessionSpendingTracker";
import { TestT402Button } from "./TestT402Button";
import { Wallet } from "../Wallet";

export const Header = () => {
  const signedIn = useIsSignedIn();
  const { evmAddress: address } = useEvmAddress();

  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);

  return (
    signedIn &&
    address && (
      <Flex align="center" gap="2" justify="between">
        <Flex align="center" gap="3" justify="center">
          <Wallet />
          <SessionSpendingTracker />
        </Flex>
        <Flex align="center" gap="2" justify="center">
          <Dialog.Root>
            <Dialog.Trigger>
              <Button size="2" radius="large" onClick={() => setIsDiscoveryOpen(true)}>
                Discovery
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="800px" height="80vh">
              <DiscoveryModal isOpen={isDiscoveryOpen} onClose={() => setIsDiscoveryOpen(false)} />
            </Dialog.Content>
          </Dialog.Root>
          {process.env.NODE_ENV === "development" && <TestT402Button />}
        </Flex>
      </Flex>
    )
  );
};
