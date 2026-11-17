/** Authenticate the existing booking PaymentIntent; never create a second payment. */
export async function authenticateBooking(
  clientSecret: string,
  publishableKey: string,
) {
  type StripeBrowser = {
    confirmCardPayment: (
      secret: string,
    ) => Promise<{ error?: { message?: string } }>;
  };
  const win = window as unknown as { Stripe?: (key: string) => StripeBrowser };
  if (!win.Stripe)
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Could not load secure payment verification."));
      document.head.appendChild(script);
    });
  if (!win.Stripe)
    throw new Error("Secure payment verification is unavailable.");
  const result = await win
    .Stripe(publishableKey)
    .confirmCardPayment(clientSecret);
  if (result.error)
    throw new Error(
      result.error.message || "Your bank could not verify the payment.",
    );
}
