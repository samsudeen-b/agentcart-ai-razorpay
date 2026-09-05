"use client";

import Image from "next/image";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Paperclip,
  Send,
  User,
} from "lucide-react";
import { FormEvent, useState } from "react";

import type { ConversationMessage } from "@/lib/agentcart-types";
import { formatInr, type Product } from "@/lib/catalog";

type ConversationPanelProps = {
  messages: readonly ConversationMessage[];
  products: readonly Product[];
  isThinking: boolean;
  showReviewActions: boolean;
  onSendMessage: (message: string) => void;
  onReviewCart: () => void;
  onKeepBrowsing: () => void;
};

function MessageIcon({ message }: { message: ConversationMessage }) {
  if (message.role === "customer") {
    return <User size={18} aria-hidden="true" />;
  }

  if (message.tone === "warning") {
    return <AlertCircle size={19} aria-hidden="true" />;
  }

  if (message.tone === "success") {
    return <CheckCircle2 size={19} aria-hidden="true" />;
  }

  return <Bot size={19} aria-hidden="true" />;
}

export function ConversationPanel({
  messages,
  products,
  isThinking,
  showReviewActions,
  onSendMessage,
  onReviewCart,
  onKeepBrowsing,
}: ConversationPanelProps) {
  const [draft, setDraft] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();

    if (!message || isThinking) {
      return;
    }

    onSendMessage(message);
    setDraft("");
  }

  return (
    <section className="ac-conversation" aria-label="Shopping conversation">
      <div className="ac-conversation-heading">
        <h1>Commerce that asks before it acts.</h1>
      </div>

      <div className="ac-message-list" aria-live="polite">
        {messages.map((message) => (
          <article
            className={`ac-message is-${message.role} is-${
              message.tone ?? "neutral"
            }`}
            key={message.id}
          >
            <time>{message.time}</time>

            <span className="ac-message-icon">
              <MessageIcon message={message} />
            </span>

            <div className="ac-message-content">
              <strong>
                {message.title ??
                  (message.role === "customer" ? "You" : "AgentCart AI")}
              </strong>

              <p>{message.content}</p>

              {message.productIds && message.productIds.length > 0 && (
                <div className="ac-message-products">
                  {message.productIds.map((productId) => {
                    const product = products.find(
                      (item) => item.id === productId,
                    );

                    if (!product) {
                      return null;
                    }

                    return (
                      <div className="ac-message-product" key={product.id}>
                        <Image
                          src={product.image}
                          alt=""
                          width={58}
                          height={58}
                        />

                        <div>
                          <strong>{product.name}</strong>
                          <span>{product.description}</span>
                        </div>

                        <div className="ac-message-product-price">
                          <strong>{formatInr(product.pricePaise)}</strong>
                          <span>Qty 1</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </article>
        ))}

        {isThinking && (
          <div className="ac-agent-thinking" role="status">
            <Bot size={18} aria-hidden="true" />
            <span>Checking catalog and policy…</span>
          </div>
        )}
      </div>

      {showReviewActions && (
        <div className="ac-conversation-actions">
          <button
            type="button"
            className="ac-primary-button"
            onClick={onReviewCart}
          >
            Review revised cart
          </button>

          <button
            type="button"
            className="ac-text-button"
            onClick={onKeepBrowsing}
          >
            Keep browsing
          </button>
        </div>
      )}

      <form className="ac-composer" onSubmit={handleSubmit}>
        <Paperclip size={19} aria-hidden="true" />

        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about products, your order or payment status…"
          aria-label="Message AgentCart"
          disabled={isThinking}
        />

        <button
          type="submit"
          aria-label="Send message"
          disabled={!draft.trim() || isThinking}
        >
          <Send size={20} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}