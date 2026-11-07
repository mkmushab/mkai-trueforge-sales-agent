import React, { useEffect, useState } from 'react';

export interface StructuredServiceError {
  ok: false;
  error: string;
  hint?: string;
}

export const DemoDataBadge: React.FC<{
  forceDemo?: boolean;
  serviceError?: StructuredServiceError | null;
  backendUrl?: string;
}> = ({
  forceDemo = false,
  serviceError = null,
  backendUrl = 'http://127.0.0.1:8765',
}) => {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(forceDemo);

  useEffect(() => {
    if (forceDemo) {
      setIsDemoMode(true);
      return;
    }
    let cancelled = false;
    fetch(`${backendUrl}/health`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && data.demo_mode === true) {
          setIsDemoMode(true);
        }
      })
      .catch(() => {
        // Ignore offline health probe errors; individual tool calls surface structured errors
      });
    return () => {
      cancelled = true;
    };
  }, [forceDemo, backendUrl]);

  if (!isDemoMode && !serviceError) {
    return null;
  }

  return (
    <div className="z-40 flex flex-col gap-2 px-4 pt-2">
      {isDemoMode && (
        <div
          data-testid="mkai-demo-data-badge"
          className="inline-flex items-center self-start gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold tracking-wide text-amber-300"
        >
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span>DEMO DATA (MKAI_DEMO_MODE=1)</span>
        </div>
      )}
      {serviceError && (
        <div
          data-testid="mkai-structured-service-error"
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200"
        >
          <div className="font-semibold text-red-300">
            Service Error: {serviceError.error}
          </div>
          {serviceError.hint && (
            <div className="mt-1 text-red-200/80">
              Hint: {serviceError.hint}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DemoDataBadge;
