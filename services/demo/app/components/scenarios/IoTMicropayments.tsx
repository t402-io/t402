"use client";

import { useState, useCallback } from "react";
import { Thermometer, Droplets, MapPin } from "lucide-react";
import { useDemoContext } from "@/providers/DemoProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { PaymentStatus, parsePaymentResponse, type SettleInfo } from "@/components/shared/PaymentStatus";
import type { FlowState } from "@/hooks/usePaymentFlow";
import { CostTicker } from "@/components/shared/CostTicker";
import { Spinner } from "@/components/shared/Spinner";
import { encodePaymentHeader } from "@/lib/t402-client";

type SensorType = "temperature" | "humidity" | "gps";

interface SensorReading {
  type: SensorType;
  value: string;
  unit: string;
  timestamp: string;
}

const SENSORS: { type: SensorType; label: string; icon: typeof Thermometer; unit: string }[] = [
  { type: "temperature", label: "Temperature", icon: Thermometer, unit: "°C" },
  { type: "humidity", label: "Humidity", icon: Droplets, unit: "%" },
  { type: "gps", label: "GPS Location", icon: MapPin, unit: "coords" },
];

export function IoTMicropayments() {
  const { isDemo, testnet } = useDemoContext();
  const { signPayment, activeFamily } = useMultiChainPayment();
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState<SensorType | null>(null);
  const [totalCost, setTotalCost] = useState(0);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [settle, setSettle] = useState<SettleInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getReading = useCallback(async (type: SensorType) => {
    setLoading(type);
    setFlowState("requesting");
    setSettle(null);
    setError(null);
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "x-preferred-chain": activeFamily,
        "x-network-mode": testnet ? "testnet" : "mainnet",
      };
      if (isDemo) headers["x-demo-mode"] = "true";

      const res = await fetch(`/api/demo/iot-data?type=${type}`, { headers });

      if (res.status === 402) {
        setFlowState("got-402");
        const paymentRequired = await res.json();
        const requirements = paymentRequired.accepts?.[0];
      if (!requirements) throw new Error("No payment options available");
        setFlowState("signing");
        const paymentPayload = await signPayment(requirements);

        const retryHeaders: Record<string, string> = {
          ...headers,
          "Payment-Signature": encodePaymentHeader(paymentPayload),
        };
        setFlowState("retrying");
        const retryRes = await fetch(`/api/demo/iot-data?type=${type}`, { headers: retryHeaders });
        setFlowState("verifying");
        setSettle(parsePaymentResponse(retryRes));
        const data = await retryRes.json();
        setReadings((prev) => [data.reading, ...prev].slice(0, 10));
        setTotalCost((prev) => prev + 0.0001);
        setFlowState("done");
      } else {
        const data = await res.json();
        setReadings((prev) => [data.reading, ...prev].slice(0, 10));
        setTotalCost((prev) => prev + 0.0001);
        setFlowState("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch sensor reading. Please try again.");
      setFlowState("error");
    } finally {
      setLoading(null);
    }
  }, [isDemo, activeFamily, signPayment]);

  return (
    <div className="space-y-6">
      {/* Sensor buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SENSORS.map((sensor) => {
          const Icon = sensor.icon;
          const isLoading = loading === sensor.type;
          return (
            <button
              key={sensor.type}
              onClick={() => getReading(sensor.type)}
              disabled={isLoading}
              className="glass-card-interactive p-4 flex items-center gap-3 text-left disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#14B8A61F" }}>
                <Icon size={16} style={{ color: "var(--color-scenario-iot)" }} />
              </div>
              <div>
                <p className="text-sm font-medium">{sensor.label}</p>
                <p className="text-[10px] text-[var(--color-muted)]">0.0001 USDT/reading</p>
              </div>
              {isLoading && <Spinner className="ml-auto" />}
            </button>
          );
        })}
      </div>

      {flowState !== "idle" && (
        <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
      )}

      {error && (
        <div className="glass-card p-4 flex items-center justify-between">
          <p className="text-xs text-[var(--color-error)]">{error}</p>
          <button
            onClick={() => { setError(null); setFlowState("idle"); }}
            className="text-xs text-[var(--color-brand)] hover:underline ml-4 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Cost ticker */}
      {totalCost > 0 && <CostTicker totalCost={totalCost} />}

      {/* Readings log */}
      {readings.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-3">
            Sensor Readings ({readings.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {readings.map((reading, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-muted)]">{reading.type}</span>
                  <span className="text-sm font-mono font-medium">{reading.value} {reading.unit}</span>
                </div>
                <span className="text-[10px] text-[var(--color-muted)]">{reading.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
