interface ComparisonStep {
  number: string;
  title: string;
  description: string;
}

interface ComparisonTableProps {
  traditionalSteps: ComparisonStep[];
  t402Steps: ComparisonStep[];
  variant?: "light" | "dark";
}

interface ScenarioComparison {
  title: string;
  traditional: string[];
  t402: string[];
}

interface ScenarioComparisonTableProps {
  scenarios: ScenarioComparison[];
  className?: string;
  variant?: "light" | "dark";
}

export function ComparisonTable({
  traditionalSteps,
  t402Steps,
  variant = "dark",
}: ComparisonTableProps) {
  const isLight = variant === "light";
  const labelColor = isLight ? "text-[#718096]" : "text-gray-40";
  const stepBorder = isLight ? "border-[#1A1A2E]" : "border-black";
  const stepTitleColor = isLight ? "text-[#1A1A2E]" : "";
  const stepDescColor = isLight ? "text-[#4A5568]" : "text-gray-60";
  const greenLabelColor = isLight ? "text-[#26A17B]" : "text-green-60";
  const greenDescColor = isLight ? "text-[#26A17B]/80" : "text-green-60";

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
        {/* Traditional Process Column */}
        <div className="flex flex-col gap-8">
          <h3 className={`text-sm sm:text-base font-bold ${labelColor} uppercase tracking-wide`}>
            The old way
          </h3>

          <div className="flex flex-col gap-8">
            {traditionalSteps.map((step, index) => (
              <div key={index} className="flex gap-3 sm:gap-4">
                <div className={`w-[34px] h-[34px] flex-shrink-0 flex items-center justify-center border ${stepBorder}`}>
                  <span className={`text-lg font-medium ${stepTitleColor}`}>{step.number}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className={`text-sm sm:text-base font-medium ${stepTitleColor}`}>{step.title}</h4>
                  <p className={`text-sm sm:text-base font-mono ${stepDescColor} leading-snug`}>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* t402 Process Column */}
        <div className="flex flex-col gap-8">
          <h3 className={`text-sm sm:text-base font-bold ${greenLabelColor} uppercase tracking-wide`}>
            With t402
          </h3>

          <div className="flex flex-col gap-8">
            {t402Steps.map((step, index) => (
              <div key={index} className="flex gap-3 sm:gap-4">
                <div className="w-[34px] h-[34px] flex-shrink-0 flex items-center justify-center border border-[#50AF95] bg-[#50AF95]">
                  <span className="text-lg font-medium text-white">
                    {step.number}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-sm sm:text-base font-medium text-[#50AF95]">
                    {step.title}
                  </h4>
                  <p className={`text-sm sm:text-base font-mono ${greenDescColor} leading-snug`}>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScenarioComparisonTable({
  scenarios,
  className = "",
  variant = "dark",
}: ScenarioComparisonTableProps) {
  const isLight = variant === "light";

  const containerBorder = isLight ? "border-[rgba(0,0,0,0.08)]" : "border-gray-10";
  const headerBg = isLight ? "bg-[#F7FAF9]" : "bg-gray-10";
  const headerText = isLight ? "text-[#718096]" : "text-gray-70";
  const divider = isLight ? "divide-[rgba(0,0,0,0.08)]" : "divide-gray-10";
  const rowEvenBg = isLight ? "even:bg-[#F7FAF9]" : "";
  const titleColor = isLight ? "text-[#1A1A2E]" : "";
  const tradColor = isLight ? "text-[#4A5568]" : "text-gray-70";
  const t402Color = isLight ? "text-[#26A17B]" : "text-accent-green";

  return (
    <div
      className={`w-full overflow-hidden border ${containerBorder} rounded-2xl ${className}`}
    >
      {/* Responsive scroll wrapper */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className={`grid grid-cols-3 ${headerBg} text-xs sm:text-sm font-semibold uppercase tracking-wide ${headerText}`}>
            <div className="px-5 py-4">Scenario</div>
            <div className="px-5 py-4">Traditional process</div>
            <div className={`px-5 py-4 ${isLight ? "bg-[#50AF95]/5" : ""}`}>With t402</div>
          </div>

          <div className={`divide-y ${divider}`}>
            {scenarios.map((scenario, idx) => (
              <div key={scenario.title} className={`grid grid-cols-3 ${isLight && idx % 2 === 1 ? "bg-[#F7FAF9]" : ""}`}>
                <div className={`px-4 sm:px-5 py-4 sm:py-6 text-sm sm:text-base font-semibold leading-snug ${titleColor}`}>
                  {scenario.title}
                </div>
                <div className="px-4 sm:px-5 py-4 sm:py-6">
                  <ul className={`list-disc pl-4 space-y-1.5 sm:space-y-2 text-xs sm:text-sm ${tradColor}`}>
                    {scenario.traditional.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className={`px-4 sm:px-5 py-4 sm:py-6 ${isLight ? "bg-[#50AF95]/5" : ""}`}>
                  <ul className={`list-disc pl-4 space-y-1.5 sm:space-y-2 text-xs sm:text-sm ${t402Color}`}>
                    {scenario.t402.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
