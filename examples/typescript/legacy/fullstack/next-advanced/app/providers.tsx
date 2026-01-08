'use client';

import { base } from 'wagmi/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';

export function Providers(props: { children: React.ReactNode }) {
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={base}
      config={{
        appearance: {
          mode: "auto",
          logo: "/t402-icon-blue.png",
          name: "Next Advanced t402 Demo",
        },
      }}
    >
      {props.children}
    </OnchainKitProvider>
  );
}

