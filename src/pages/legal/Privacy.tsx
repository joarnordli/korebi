import LegalLayout from "./LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        Okiro ("we", "us") is a daily photo-journal app. We take your privacy seriously and collect
        only the data we need to make the app work. This policy explains what we collect, why, and
        what control you have.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Account data:</strong> email address, display name, and (if you use Google or Apple sign-in) the basic profile info those providers return.</li>
        <li><strong>Your memories:</strong> the photos and notes you choose to save. Photos are encrypted on your device before upload (AES-256-GCM) so that even our infrastructure provider cannot view them.</li>
        <li><strong>Subscription data:</strong> a Stripe customer ID and your subscription status. We never see or store your card details — Stripe handles payment data directly.</li>
        <li><strong>Push notification tokens:</strong> if you enable notifications, an anonymous device token so we can deliver reminders.</li>
        <li><strong>Technical data:</strong> minimal logs (timestamps, error traces) needed to operate the service.</li>
      </ul>

      <h2>2. Why we use it (legal basis)</h2>
      <ul>
        <li><strong>Contract (GDPR Art. 6(1)(b)):</strong> to provide the journaling service you signed up for.</li>
        <li><strong>Legitimate interest (Art. 6(1)(f)):</strong> to keep the service secure, prevent abuse, and improve reliability.</li>
        <li><strong>Consent (Art. 6(1)(a)):</strong> for optional features like push notifications. You can withdraw consent at any time.</li>
      </ul>

      <h2>3. Who we share data with</h2>
      <p>We use a small number of trusted processors:</p>
      <ul>
        <li><strong>Lovable Cloud / Supabase</strong> — hosting, database, and storage (EU region).</li>
        <li><strong>Stripe</strong> — subscription billing.</li>
        <li><strong>Web Push providers</strong> (Apple, Google, Mozilla) — delivery of push notifications.</li>
      </ul>
      <p>We do not sell your data, and we do not share it for advertising.</p>

      <h2>4. International transfers</h2>
      <p>
        Some processors (e.g. Stripe) may transfer data outside the EEA. Where they do, transfers are
        protected by the European Commission's Standard Contractual Clauses or equivalent safeguards.
      </p>

      <h2>5. Retention</h2>
      <p>
        We keep your account and memories for as long as your account is active. If you delete your
        account (Profile → Delete account), all your data is permanently removed within 30 days.
        Backups are rotated within 30 days.
      </p>

      <h2>6. Your rights</h2>
      <p>Under GDPR and similar laws (CCPA/CPRA), you have the right to:</p>
      <ul>
        <li>Access the data we hold about you</li>
        <li>Correct inaccurate data</li>
        <li>Delete your data (right to erasure)</li>
        <li>Export your data (portability)</li>
        <li>Object to or restrict processing</li>
        <li>Withdraw consent at any time</li>
        <li>Lodge a complaint with your local data-protection authority (in Norway: Datatilsynet)</li>
      </ul>
      <p>
        To exercise any of these rights, email{" "}
        <a href="mailto:hello@okiro.online">hello@okiro.online</a> or use Profile → Delete account.
      </p>

      <h2>7. Children</h2>
      <p>
        Okiro is not directed at children. You must be at least 13 years old (16 in the EEA) to use
        the service. If we learn we have collected data from a child below this age, we will delete it.
      </p>

      <h2>8. Security</h2>
      <p>
        Photos are encrypted client-side before upload. Connections use TLS. We follow standard
        industry practices, but no service can guarantee absolute security.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update this policy as the service evolves. Material changes will be announced in the
        app or by email at least 14 days before they take effect.
      </p>

      <h2>10. Contact &amp; abuse reports</h2>
      <p>
        Questions or privacy requests: <a href="mailto:hello@okiro.online">hello@okiro.online</a>.
      </p>
      <p>
        DMCA / abuse / illegal-content notices:{" "}
        <a href="mailto:hello@okiro.online">hello@okiro.online</a>. You can also report a specific
        memory from inside the app (⋯ menu → Report or remove).
      </p>

      <h2>11. Operator</h2>
      <p>
        Okiro is operated by Nordli Media, Carl Berners Plass 2, Oslo, Norway.
      </p>
    </LegalLayout>
  );
}
