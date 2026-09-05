"use client";

import { ExternalLink, FlaskConical, ShoppingBag } from "lucide-react";

type AgentCartHeaderProps = {
  sourceHref?: string;
  onOpenScenarios: () => void;
};

export function AgentCartHeader({
  sourceHref,
  onOpenScenarios,
}: AgentCartHeaderProps) {
  return (
    <header className="ac-header">
      <div className="ac-brand">
        <span className="ac-brand-mark" aria-hidden="true">
          <ShoppingBag size={22} strokeWidth={1.8} />
        </span>

        <div>
          <p>AgentCart AI</p>
          <span>Bounded commerce agent</span>
        </div>
      </div>

      <div className="ac-test-mode">
        <FlaskConical size={18} aria-hidden="true" />
        <span>Razorpay Test Mode</span>
      </div>

      <nav className="ac-header-actions" aria-label="Project navigation">
        {sourceHref ? (
          <a href={sourceHref} target="_blank" rel="noreferrer">
            View source
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        ) : (
          <span className="ac-source-unavailable" aria-disabled="true">
            View source
            <ExternalLink size={15} aria-hidden="true" />
          </span>
        )}

        <button type="button" onClick={onOpenScenarios}>
          Demo scenarios
        </button>
      </nav>
    </header>
  );
}