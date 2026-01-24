"use client";

import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { IoTMicropayments } from "@/components/scenarios/IoTMicropayments";

export default function IoTMicropaymentsPage() {
  return (
    <ScenarioShell
      title="IoT Micropayments"
      description="Sensor data on demand. Pay per reading — temperature, humidity, GPS coordinates."
      cost="0.0001 USDT/reading"
      accentColor="var(--color-scenario-iot)"
    >
      <IoTMicropayments />
    </ScenarioShell>
  );
}
