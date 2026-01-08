import { Button } from "../Button";
import { makeT402Request } from "../../utils/t402Client";

/**
 * Button to send a test t402 request to the demo endpoint.
 *
 * @returns {JSX.Element} Rendered test button.
 */
export function TestT402Button() {
  const handleTestT402 = async () => {
    try {
      await makeT402Request({
        baseURL: "https://t402-demo-discovery-endpoint.vercel.app",
        path: "/protected",
        method: "GET",
        correlationId: `manual-test-${Date.now()}`,
      });
    } catch (e) {
      // Errors will be reflected in the Operations list via existing handlers
      console.error(e);
    }
  };

  return (
    <Button size="2" radius="large" onClick={handleTestT402}>
      Test t402
    </Button>
  );
}
