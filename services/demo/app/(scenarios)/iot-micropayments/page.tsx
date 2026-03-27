import type { Metadata } from "next";
import { Cpu } from "lucide-react";
import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { IoTMicropayments } from "@/components/scenarios/IoTMicropayments";

// Force dynamic rendering to avoid SSR issues with wallet SDKs
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "IoT Micropayments | T402 Demo",
  description: "Sensor data on demand — pay 0.0001 USDT per reading. Temperature, humidity, GPS via HTTP 402 micropayments.",
  openGraph: {
    title: "IoT Micropayments — T402",
    description: "Pay-per-reading IoT sensor data with USDT.",
  },
};

export default function IoTMicropaymentsPage() {
  return (
    <ScenarioShell
      icon={Cpu}
      title="IoT Micropayments"
      description="Sensor data on demand. Pay per reading — temperature, humidity, GPS coordinates."
      cost="0.0001 USDT/reading"
      accentColor="var(--color-scenario-iot)"
      scenarioId="iot-micropayments"
    >
      <IoTMicropayments />
    </ScenarioShell>
  );
}
