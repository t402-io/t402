import { describe, expect, it } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { PaymentProgress, usePaymentProgress } from "./PaymentProgress";

/**
 * Render component to static HTML string for assertion
 */
function renderToHtml(element: React.ReactElement): string {
  return ReactDOMServer.renderToStaticMarkup(element);
}

describe("PaymentProgress", () => {
  describe("renders all 4 step labels", () => {
    it("shows Connect, Sign, Submit, Confirm labels", () => {
      const html = renderToHtml(<PaymentProgress currentStep="connect" />);
      expect(html).toContain("Connect");
      expect(html).toContain("Sign");
      expect(html).toContain("Submit");
      expect(html).toContain("Confirm");
    });
  });

  describe("completed steps", () => {
    it("completed steps before currentStep show check SVG", () => {
      const html = renderToHtml(<PaymentProgress currentStep="submit" />);
      // Steps 0 (connect) and 1 (sign) are completed, should have check icon path
      // The check icon has path d="M11.5 4L5.5 10L2.5 7"
      const checkCount = (html.match(/M11\.5 4L5\.5 10L2\.5 7/g) || []).length;
      expect(checkCount).toBe(2);
    });
  });

  describe("current step with isProcessing", () => {
    it("shows spinner SVG for current step when isProcessing is true", () => {
      const html = renderToHtml(<PaymentProgress currentStep="sign" isProcessing={true} />);
      // The spinner has class "progress-spinner" and a circle element
      expect(html).toContain("progress-spinner");
      // The spinner step should have "processing" class
      expect(html).toContain("processing");
    });
  });

  describe("current step with hasError", () => {
    it("shows error styling on current step", () => {
      const html = renderToHtml(<PaymentProgress currentStep="sign" hasError={true} />);
      expect(html).toContain("error");
    });
  });

  describe("pending steps", () => {
    it("pending steps show step number", () => {
      const html = renderToHtml(<PaymentProgress currentStep="connect" />);
      // Steps 2 (Submit), 3 (Submit), 4 (Confirm) are pending
      // Should show step numbers 2, 3, 4 in progress-step-number spans
      expect(html).toContain("progress-step-number");
    });
  });

  describe("progressbar role", () => {
    it("has role=progressbar with aria attributes", () => {
      const html = renderToHtml(<PaymentProgress currentStep="sign" />);
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuenow="2"');
      expect(html).toContain('aria-valuemin="1"');
      expect(html).toContain('aria-valuemax="4"');
      expect(html).toContain('aria-label="Payment progress: Sign"');
    });
  });

  describe("step connectors", () => {
    it("renders connectors between steps but not after the last", () => {
      const html = renderToHtml(<PaymentProgress currentStep="connect" />);
      // There should be 3 connectors between 4 steps
      const connectorCount = (html.match(/progress-connector/g) || []).length;
      expect(connectorCount).toBe(3);
    });
  });

  describe("usePaymentProgress hook", () => {
    it("getStep returns connect when not connected", () => {
      const { getStep } = usePaymentProgress();
      expect(
        getStep({
          isConnected: false,
          isSigning: false,
          isSubmitting: false,
          isConfirmed: false,
        }),
      ).toBe("connect");
    });

    it("getStep returns sign when connected", () => {
      const { getStep } = usePaymentProgress();
      expect(
        getStep({
          isConnected: true,
          isSigning: false,
          isSubmitting: false,
          isConfirmed: false,
        }),
      ).toBe("sign");
    });

    it("getStep returns sign when signing", () => {
      const { getStep } = usePaymentProgress();
      expect(
        getStep({
          isConnected: true,
          isSigning: true,
          isSubmitting: false,
          isConfirmed: false,
        }),
      ).toBe("sign");
    });

    it("getStep returns submit when submitting", () => {
      const { getStep } = usePaymentProgress();
      expect(
        getStep({
          isConnected: true,
          isSigning: false,
          isSubmitting: true,
          isConfirmed: false,
        }),
      ).toBe("submit");
    });

    it("getStep returns confirm when confirmed", () => {
      const { getStep } = usePaymentProgress();
      expect(
        getStep({
          isConnected: true,
          isSigning: false,
          isSubmitting: false,
          isConfirmed: true,
        }),
      ).toBe("confirm");
    });
  });
});
