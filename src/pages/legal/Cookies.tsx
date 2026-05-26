import LegalLayout from "./LegalLayout";

export default function Cookies() {
  return (
    <LegalLayout title="Cookie & Storage Policy">
      <p>
        Okiro keeps cookies and browser storage to a minimum. We do not use advertising cookies,
        cross-site trackers, or third-party analytics scripts.
      </p>

      <h2>1. What we store on your device</h2>
      <ul>
        <li><strong>Authentication session</strong> — stored in localStorage so you stay signed in across visits. Strictly necessary.</li>
        <li><strong>App cache</strong> — a small React Query cache so the feed loads instantly on return visits. Strictly necessary.</li>
        <li><strong>Install / onboarding state</strong> — flags such as whether you've dismissed the "Add to Home Screen" prompt.</li>
        <li><strong>Push subscription</strong> — if you enable notifications, your device stores the push endpoint.</li>
      </ul>

      <h2>2. Third-party cookies</h2>
      <p>
        When you start a subscription, you are redirected to Stripe Checkout. Stripe sets its own
        cookies necessary for payment processing and fraud prevention. See{" "}
        <a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noopener noreferrer">Stripe's cookie policy</a>.
      </p>

      <h2>3. Consent</h2>
      <p>
        Because Okiro only uses strictly-necessary storage and Stripe's payment cookies, no
        consent banner is required under the ePrivacy Directive. If we ever add analytics or
        advertising cookies, we will ask for your consent first.
      </p>

      <h2>4. Clearing storage</h2>
      <p>
        You can clear everything Okiro stores by clearing site data in your browser settings, or by
        deleting your account (Profile → Delete account) which also removes server-side data.
      </p>

      <h2>5. Contact</h2>
      <p>Questions? Email <a href="mailto:hello@okiro.online">hello@okiro.online</a>.</p>
    </LegalLayout>
  );
}
