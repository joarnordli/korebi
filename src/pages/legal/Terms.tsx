import LegalLayout from "./LegalLayout";

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service">
      <p>
        Welcome to Okiro. By creating an account or using the app, you agree to these terms.
        Please read them — they're short.
      </p>

      <h2>1. Eligibility</h2>
      <p>You must be at least 13 years old (16 in the EEA) to use Okiro and capable of forming a binding contract.</p>

      <h2>2. Your account</h2>
      <p>
        You are responsible for keeping your login credentials secure and for activity on your account.
        Let us know immediately at <a href="mailto:hello@okiro.online">hello@okiro.online</a> if you
        suspect unauthorized access.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Upload illegal, abusive, or infringing content</li>
        <li>Attempt to access other users' data or break the service</li>
        <li>Use Okiro to harass, threaten, or harm anyone</li>
        <li>Resell or commercially exploit the service without permission</li>
      </ul>
      <p>We may suspend or terminate accounts that violate these rules.</p>

      <h2>4. Your content</h2>
      <p>
        You own the photos and notes you upload. You grant Okiro a limited, non-exclusive license to
        store, process and display your content back to you so we can provide the service. We never
        use your content to train AI models or share it with advertisers.
      </p>

      <h2>5. Subscription, billing and refunds</h2>
      <ul>
        <li>New accounts get a <strong>7-day free trial</strong>. No charge until the trial ends.</li>
        <li>After the trial, Okiro is <strong>28 NOK / month</strong>, billed automatically until you cancel.</li>
        <li>You can cancel anytime from Profile → Manage subscription. Cancellation stops future charges; the current period is not refunded.</li>
        <li>Refunds may be granted at our discretion for billing errors. EEA consumers retain statutory withdrawal rights where applicable.</li>
      </ul>

      <h2>6. Service availability</h2>
      <p>
        We aim for high reliability but provide Okiro "as is" without warranties. We may change,
        suspend or discontinue features with reasonable notice.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the maximum extent allowed by law, Okiro is not liable for indirect, incidental or
        consequential damages, or for lost data beyond the amount you paid us in the prior 12 months.
        Nothing in these terms limits liability that cannot be excluded under applicable consumer law.
      </p>

      <h2>8. Termination</h2>
      <p>
        You can delete your account at any time from Profile → Delete account. We may terminate or
        suspend access for breach of these terms.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These terms are governed by the laws of Norway. Disputes are subject to the non-exclusive
        jurisdiction of the Norwegian courts, without prejudice to mandatory consumer-protection rights
        in your country of residence.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these terms. Material changes will be announced at least 14 days before they
        take effect. Continued use after that date means you accept the new terms.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions? Email <a href="mailto:hello@okiro.online">hello@okiro.online</a>.
      </p>

      <h2>12. Reporting illegal or infringing content</h2>
      <p>
        Okiro stores private journals — content is visible only to the user who created it. If you
        believe an Okiro user is hosting illegal, infringing, or abusive content (for example,
        because of a court order, a DMCA notice, or because your account is being misused), please
        contact us and we will respond within 10 business days.
      </p>
      <p>
        <strong>Designated agent for DMCA / abuse notices:</strong>
        <br />
        Nordli Media (operator of Okiro)
        <br />
        Carl Berners Plass 2, Oslo, Norway
        <br />
        <a href="mailto:hello@okiro.online">hello@okiro.online</a>
      </p>

      <h2>13. Operator</h2>
      <p>
        Okiro is operated by Nordli Media, Carl Berners Plass 2, Oslo, Norway.
      </p>
    </LegalLayout>
  );
}
