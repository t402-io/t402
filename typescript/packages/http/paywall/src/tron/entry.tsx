import { createRoot } from "react-dom/client";
import { TronPaywall } from "./TronPaywall";
import type {} from "../window";

// TRON-specific paywall entry point
window.addEventListener("load", () => {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Root element not found");
    return;
  }

  const t402 = window.t402;
  const paymentRequired = t402.paymentRequired;

  if (!paymentRequired?.accepts?.[0]) {
    console.error("No payment requirements found");
    return;
  }

  const root = createRoot(rootElement);
  root.render(
    <TronPaywall
      paymentRequired={paymentRequired}
      onSuccessfulResponse={async (response: Response) => {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          document.documentElement.innerHTML = await response.text();
        } else {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          window.location.href = url;
        }
      }}
    />,
  );
});
