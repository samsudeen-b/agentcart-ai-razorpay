export {};

declare global {
  type RazorpaySuccessResponse = {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };

  type RazorpayFailureResponse = {
    error: {
      code: string;
      description: string;
      source?: string;
      step?: string;
      reason?: string;
      metadata?: {
        order_id?: string;
        payment_id?: string;
      };
    };
  };

  type RazorpayCheckoutOptions = {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpaySuccessResponse) => void;
    modal?: {
      ondismiss?: () => void;
    };
    theme?: {
      color?: string;
    };
  };

  type RazorpayCheckoutInstance = {
    open: () => void;
    close: () => void;
    on: (
      event: "payment.failed",
      callback: (response: RazorpayFailureResponse) => void,
    ) => void;
  };

  interface Window {
    Razorpay: new (
      options: RazorpayCheckoutOptions,
    ) => RazorpayCheckoutInstance;
  }
}