"use client";

import {
  CreditCard,
  PackageX,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";


import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DemoScenarioId } from "@/lib/agentcart-types";



type DemoScenariosProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunScenario: (scenario: DemoScenarioId) => void;
};

const scenarios = [
  {
    id: "inventory_change",
    title: "Inventory changes mid-chat",
    description:
      "Block an unavailable item, prepare a safe alternative and require fresh approval.",
    icon: PackageX,
  },
  {
    id: "duplicate_approval",
    title: "Order response is lost",
    description:
      "Retry approval without creating a second Razorpay order.",
    icon: RefreshCcw,
  },
  {
    id: "payment_failure",
    title: "Payment attempt fails",
    description:
      "Preserve the cart, record the failure and offer a safe retry path.",
    icon: CreditCard,
  },
  {
    id: "invalid_parameter",
    title: "Invalid parameter is injected",
    description:
      "Reject a manipulated price, unknown product or unsafe quantity.",
    icon: ShieldAlert,
  },
] as const;

export function DemoScenarios({
  open,
  onOpenChange,
  onRunScenario,
}: DemoScenariosProps) {
  function runScenario(scenario: DemoScenarioId) {
    onRunScenario(scenario);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ac-scenario-dialog">
        <DialogHeader>
          <DialogTitle>Choose a failure scenario</DialogTitle>
          <DialogDescription>
            Each scenario demonstrates a controlled failure and a visible
            recovery path.
          </DialogDescription>
        </DialogHeader>

        <div className="ac-scenario-list">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon;

            return (
              <button
                type="button"
                className="ac-scenario-option"
                key={scenario.id}
                onClick={() => runScenario(scenario.id)}
              >
                <span>
                  <Icon size={20} aria-hidden="true" />
                </span>

                <span>
                  <strong>{scenario.title}</strong>
                  <small>{scenario.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}