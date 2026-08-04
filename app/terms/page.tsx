import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { TopTicker } from '@/components/layout/TopTicker'
import {
  LegalDoc,
  LegalSection,
  ShortVersion,
  Callout,
  Defs,
  DefRow,
  TableWrap,
  type TocItem,
} from '@/components/legal/LegalDoc'
import styles from '../legal.module.css'

export const metadata = {
  title: 'Terms of Service | ReadyPack',
  description:
    'The agreement between you and MOFE LTD when you buy a ReadyPack compliance documentation pack, including our data processing terms.',
}

const TOC: readonly TocItem[] = [
  { id: 'about', label: 'These terms' },
  { id: 'what-it-is', label: 'What ReadyPack is' },
  { id: 'not-advice', label: 'What it is not' },
  { id: 'ordering', label: 'Ordering and payment' },
  { id: 'delivery', label: 'What you get, and when' },
  { id: 'your-part', label: 'What we need from you' },
  { id: 'guarantee', label: 'The 14-day guarantee' },
  { id: 'ownership', label: 'Who owns what' },
  { id: 'using', label: 'Using your documents' },
  { id: 'acceptable-use', label: 'Acceptable use' },
  { id: 'availability', label: 'Availability' },
  { id: 'liability', label: 'Our liability' },
  { id: 'confidentiality', label: 'Confidentiality' },
  { id: 'ending', label: 'Ending this agreement' },
  { id: 'general', label: 'General' },
  { id: 'data-processing', label: 'Schedule 1 — Data processing' },
]

export default function TermsPage() {
  return (
    <>
      <TopTicker />
      <Nav />

      <main>
        <LegalDoc
          badge="Legal"
          title="Terms of Service"
          standfirst="The agreement between you and MOFE LTD when you buy a ReadyPack pack. Written to be read, not to be survived."
          effective="27 July 2026"
          updated="27 July 2026"
          toc={TOC}
        >
          <ShortVersion note="This summary is a signpost. The numbered clauses below are the agreement.">
            <li>
              You pay once. £249, £499 or £799 depending on the pack. No subscription, no
              VAT on top.
            </li>
            <li>
              We deliver within 48 hours of you <strong>submitting the questionnaire</strong>
              , not of you paying. Higher-risk cases can take up to 72 hours, and the
              questionnaire tells you if yours is one.
            </li>
            <li>
              You own the documents. Publish them, edit them, send them to a buyer, put
              your name on them. No credit to us required.
            </li>
            <li>
              If the pack is not what you expected, email us within 14 days of delivery and
              we refund you in full. No forms.
            </li>
            <li>
              We produce documentation. We are not a law firm and this is not legal advice.
            </li>
            <li>
              Schedule 1 is a full data processing agreement. You already have it, so you
              do not need to negotiate one with us before you buy.
            </li>
          </ShortVersion>

          <LegalSection id="about" num="01" title="These terms">
            <p>
              These terms are the agreement between you and <strong>MOFE LTD</strong>, a
              company registered in England and Wales under number{' '}
              <strong>16633320</strong>, registered office First Floor, Swan Buildings, 20
              Swan Street, Manchester M4 5JW, trading as ReadyPack. In these terms
              &ldquo;we&rdquo; and &ldquo;us&rdquo; means MOFE LTD, and &ldquo;you&rdquo;
              means the business buying a pack.
            </p>
            <p>
              You accept these terms when you pay for a pack. If you are agreeing on behalf
              of a company, you confirm you are authorised to do so.
            </p>
            <p>
              <strong>ReadyPack is sold to businesses.</strong> We supply to organisations
              and to individuals acting in the course of a trade or profession, not to
              consumers. That means the statutory consumer cancellation rights for distance
              selling do not apply to this purchase. We give you the 14-day guarantee in{' '}
              <a href="#guarantee">clause 7</a> anyway, as a contractual promise, because
              we think it is the right way to sell something you cannot inspect first.
            </p>
            <p>
              How we handle personal data is set out in our{' '}
              <a href="/privacy">Privacy Notice</a>, which forms part of this agreement.
            </p>
          </LegalSection>

          <LegalSection id="what-it-is" num="02" title="What ReadyPack is">
            <p>
              ReadyPack is a documentation service. You answer a structured questionnaire
              about how your business uses AI. We use those answers to produce a set of
              written documents tailored to what you told us &mdash; policies, registers,
              statements and procedures covering UK GDPR, the EU AI Act and the UK Data
              (Use and Access) Act 2025.
            </p>
            <p>
              The documents are drafted by an AI model and then quality-checked before
              delivery: completeness, consistency with your answers, and accuracy against
              current guidance. Where your answers flag something higher-risk or uncertain,
              the pack is held back for a closer manual review rather than sent
              automatically. Exactly what is sent to the AI provider, and what is held
              back, is set out in <a href="/privacy#ai">section 5 of our Privacy Notice</a>.
            </p>
          </LegalSection>

          <LegalSection id="not-advice" num="03" title="What it is not">
            <Callout tone="warn">
              <p>
                ReadyPack is a trading name of MOFE LTD (company number 16633320). The
                documentation packs are templates produced and reviewed by us.{' '}
                <strong>
                  They do not constitute legal, tax, or regulatory advice.
                </strong>{' '}
                Your use of the documents in your business is at your own discretion. Where
                you require advice on your specific circumstances, please engage a qualified
                solicitor or accountant.
              </p>
            </Callout>
            <p>To be completely unambiguous, we are not, and do not claim to be:</p>
            <ul>
              <li>a law firm, or a provider of legal services;</li>
              <li>a regulatory authority, or approved or endorsed by one;</li>
              <li>a tax adviser, financial adviser or accountancy practice;</li>
              <li>an ICO-approved supplier &mdash; no such approval exists for what we do;</li>
              <li>a compliance guarantee or certification of any kind.</li>
            </ul>
            <p>
              Buying a pack does not make your business compliant. It gives you the
              documentation that compliance is normally evidenced with. Whether you are
              actually compliant depends on what you do, not on what your paperwork says.
            </p>
            <p>
              We cannot help with active enforcement action, an ICO investigation already
              underway, a specific contract negotiation, or litigation. If you ask, we will
              tell you that and point you towards someone who can.
            </p>
          </LegalSection>

          <LegalSection id="ordering" num="04" title="Ordering and payment">
            <TableWrap>
              <thead>
                <tr>
                  <th scope="col">Pack</th>
                  <th scope="col">Price</th>
                  <th scope="col">What it covers</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Solo</td>
                  <td>£249</td>
                  <td>One business, one tailored pack.</td>
                </tr>
                <tr>
                  <td>Procurement-Ready</td>
                  <td>£499</td>
                  <td>
                    One business, one tailored pack, with the documents additionally
                    tailored to a specific tender or client you tell us about.
                  </td>
                </tr>
                <tr>
                  <td>Adviser</td>
                  <td>£799</td>
                  <td>
                    Three individually tailored packs, for advisers producing documentation
                    for their own clients.
                  </td>
                </tr>
              </tbody>
            </TableWrap>
            <p>
              Prices are in pounds sterling and are the total amount you pay.{' '}
              <strong>We are not currently registered for VAT, so no VAT is added.</strong>{' '}
              If that changes we will update this page and show any VAT separately at
              checkout before you pay.
            </p>
            <p>
              Payment is a one-off charge taken at checkout. There is no subscription and
              no recurring charge. Payment is processed by Stripe on their own checkout
              page &mdash; we never see or hold your card details.
            </p>
            <p>
              Your order is confirmed when Stripe confirms the payment. We then email you a
              secure link to your questionnaire. If that email does not arrive, check your
              spam folder and then email{' '}
              <a href="mailto:hello@readypack.co.uk">hello@readypack.co.uk</a> &mdash; we
              can resend it.
            </p>
          </LegalSection>

          <LegalSection id="delivery" num="05" title="What you get, and when">
            <p>
              Every pack contains nine documents: an AI Use Statement, a Privacy Notice
              addendum, an AI Risk Register, a DPIA-Lite, an Internal AI Use Policy,
              Customer Disclosure snippets, a Vendor AI Register, a Complaints Procedure
              pack, and a Procurement Response Memo. They are delivered as PDFs through your
              customer portal, and we email you when they are ready.
            </p>

            <Callout>
              <p>
                <strong>The 48 hours runs from submission, not from purchase.</strong> The
                clock starts when you submit your completed questionnaire, because we cannot
                write anything until you have told us about your business. If you buy today
                and fill the questionnaire in next week, delivery is 48 hours from next
                week.
              </p>
            </Callout>

            <p>
              Where your answers indicate a higher-risk situation, the pack is routed for a
              closer manual review and delivery can take up to 72 hours. The questionnaire
              tells you which applies to you at the point you submit, so you are never
              guessing.
            </p>
            <p>
              These are the timescales we work to and expect to meet. They are not a
              refund-backed service level, and being late is not by itself a reason for a
              refund &mdash; but if we are going to miss it we will email you and tell you
              why rather than leaving you wondering, and the guarantee in{' '}
              <a href="#guarantee">clause 7</a> covers you either way.
            </p>
            <p>
              Occasionally your answers leave a gap we genuinely cannot fill by guessing. In
              that case we come back to you with a specific question instead of inventing an
              answer. The clock pauses while we wait for your reply.
            </p>
          </LegalSection>

          <LegalSection id="your-part" num="06" title="What we need from you">
            <p>
              Your pack is built entirely from your answers. That has two consequences and
              you should know both of them before you buy.
            </p>
            <p>
              <strong>Your answers need to be accurate and complete.</strong> If you leave
              out an AI tool, understate what it does, or describe a policy you do not
              actually follow, the pack will document a business that does not exist. That
              is worse than having no pack, because you will hand it to a buyer. We are not
              responsible for a pack that is wrong because the answers were wrong.
            </p>
            <p>
              <strong>Your pack describes a moment in time.</strong> It reflects what you
              told us, assessed against the regulations as they stood on the date printed on
              the documents. If you adopt a new AI tool, change how you use an existing one,
              or the law changes, your pack does not update itself. Reviewing it is your
              responsibility &mdash; each document carries a review date to prompt you.
            </p>
            <p>
              You also confirm that where you give us personal data about other people
              &mdash; naming a colleague as your governance contact, for example &mdash; you
              are entitled to do so and have told them what they need to be told.
            </p>
          </LegalSection>

          <LegalSection id="guarantee" num="07" title="The 14-day guarantee">
            <p>
              If your pack does not meet the standard you expected, email{' '}
              <a href="mailto:hello@readypack.co.uk">hello@readypack.co.uk</a> within{' '}
              <strong>14 days of delivery</strong> and we will refund you in full. No
              questions, no forms, no requirement to explain yourself.
            </p>
            <p>
              We refund to the original payment method. Stripe normally takes five to ten
              working days to return it to your account. On the Adviser Pack, a refund
              covers the whole order rather than a single pack within it.
            </p>
            <p>
              This is a promise we choose to make, not a statutory right you would otherwise
              have as a business customer. It sits on top of anything the law does give you,
              and nothing in these terms limits your legal rights.
            </p>
            <p>
              Once refunded, the licence in <a href="#ownership">clause 8</a> ends and you
              should stop using and distributing the documents. We do not expect to chase
              anyone about this, and we would rather refund a disappointed customer than
              argue with one.
            </p>
          </LegalSection>

          <LegalSection id="ownership" num="08" title="Who owns what">
            <h3 className={styles.h3}>Your documents are yours</h3>
            <p>
              When your payment clears, you get a perpetual, worldwide, irrevocable,
              royalty-free right to use the documents we produce for you however you like:
              adopt them as your own policies, edit them, publish them, put your own branding
              on them, and send them to clients, buyers and regulators. No attribution to
              ReadyPack is required and there is nothing further to pay, ever.
            </p>
            <p>
              On the Adviser Pack, that right extends to producing and handing over the
              documents to your own clients as part of your services to them.
            </p>

            <h3 className={styles.h3}>Your answers stay yours</h3>
            <p>
              We claim no ownership of anything you type into the questionnaire or upload to
              us. We use it to build your pack and for nothing else.
            </p>

            <h3 className={styles.h3}>Our system stays ours</h3>
            <p>
              We keep ownership of the ReadyPack website, software, questionnaire design,
              document templates, underlying prompts and generic template text. You are
              buying the output, not the machine that made it.
            </p>
            <p>
              We improve those generic templates over time based on what we learn from doing
              this work. <strong>We never reuse your specific content for another
              customer.</strong> Anything that goes into our reusable library is generic
              compliance wording, written to be usable by any business, with nothing
              client-specific in it.
            </p>
          </LegalSection>

          <LegalSection id="using" num="09" title="Using your documents">
            <p>
              The documents are a starting point that you adopt and take responsibility for.
              Before you rely on one, read it. Before you publish one, check that it
              describes what your business actually does.
            </p>
            <p>
              Some of the documents are written to be published and some are not. Your pack
              comes with a read-me that tells you which is which, and why. Publishing an
              internal risk register because nobody told you not to is a real way to hurt
              yourself, so we tell you.
            </p>
            <p>
              Where a document quotes or paraphrases a regulation, it cites the source by
              name so you can check it. If you find something in your pack you believe is
              wrong, tell us &mdash; we would rather fix it than have it sitting in your
              procurement file.
            </p>
          </LegalSection>

          <LegalSection id="acceptable-use" num="10" title="Acceptable use">
            <p>You agree not to:</p>
            <ul>
              <li>
                resell, sublicense or redistribute ReadyPack itself, or provide access to
                the questionnaire to anyone outside your organisation (the Adviser Pack
                covers producing packs for your own clients, which is different);
              </li>
              <li>
                use the service to produce documentation for a business you are not
                authorised to act for;
              </li>
              <li>
                submit personal data about anyone without the authority to do so, or submit
                special category data or third-party records into the free-text fields;
              </li>
              <li>
                copy, scrape, reverse-engineer or attempt to extract our templates, prompts
                or questionnaire logic;
              </li>
              <li>
                attempt to interfere with, overload or gain unauthorised access to the
                service or another customer&rsquo;s data;
              </li>
              <li>
                present ReadyPack as a certification, a regulatory approval, or legal advice
                to a third party.
              </li>
            </ul>
            <p>
              If you breach this clause we may suspend or close your account. Where we do,
              we will tell you why and, unless the breach was deliberate, we will refund the
              unused part of your order.
            </p>
          </LegalSection>

          <LegalSection id="availability" num="11" title="Availability">
            <p>
              We aim to keep the service available, but we do not promise it will be
              uninterrupted or error-free. We rely on third-party providers for hosting, the
              database, email and the AI model, and an outage at any of them can stop us
              delivering for a while.
            </p>
            <p>
              We may change or improve the service, the questionnaire and the document set
              over time. If a change materially reduces what you have already bought and not
              yet received, we will tell you and you can have a refund.
            </p>
            <p>
              Your documents remain available in your portal for 24 months from delivery, as
              set out in our <a href="/privacy#how-long">Privacy Notice</a>. Download your
              own copy &mdash; do not treat our portal as your only archive.
            </p>
          </LegalSection>

          <LegalSection id="liability" num="12" title="Our liability">
            <p>
              Nothing in these terms limits or excludes our liability for death or personal
              injury caused by our negligence, for fraud or fraudulent misrepresentation, or
              for anything else that cannot lawfully be limited.
            </p>
            <p>Subject to that:</p>
            <ul>
              <li>
                <strong>Our total liability</strong> to you for everything connected with
                this agreement is capped at the total amount you have paid us for the order
                in question.
              </li>
              <li>
                <strong>We are not liable</strong> for loss of profit, loss of revenue, loss
                of a contract or tender, loss of anticipated savings, loss of goodwill, or
                any indirect or consequential loss.
              </li>
              <li>
                <strong>We are not liable</strong> for a regulatory finding, fine or
                enforcement action against you. Your compliance depends on what your business
                does, and we do not control that.
              </li>
              <li>
                <strong>We are not liable</strong> for a pack that is inaccurate because the
                answers you gave us were inaccurate or incomplete.
              </li>
            </ul>
            <p>
              This allocation of risk is reflected in the price. A pack costs a few hundred
              pounds precisely because we are supplying documentation rather than underwriting
              your regulatory position. If you need advice you can rely on and sue over,
              engage a solicitor &mdash; and we will say so to your face rather than sell you
              something that is not that.
            </p>
          </LegalSection>

          <LegalSection id="confidentiality" num="13" title="Confidentiality">
            <p>
              We treat what you tell us about your business as confidential. We do not
              publish it, discuss it, or share it with anyone beyond the suppliers named in
              our <a href="/privacy#where">Privacy Notice</a>, each of whom is engaged under
              a written agreement.
            </p>
            <p>
              We will not name you as a customer, quote you, or use your logo in our
              marketing unless you tell us in writing that we may.
            </p>
          </LegalSection>

          <LegalSection id="ending" num="14" title="Ending this agreement">
            <p>
              A pack is a one-off purchase, so there is nothing to cancel. The agreement
              ends when the pack is delivered and the guarantee period has passed &mdash;
              except for the clauses that are meant to survive it: ownership and licence,
              liability, confidentiality, and Schedule 1.
            </p>
            <p>
              You can ask us to close your account and delete your data at any time; see{' '}
              <a href="/privacy#rights">your rights</a>. Closing your account before
              delivery means we cannot deliver, and we will refund you.
            </p>
          </LegalSection>

          <LegalSection id="general" num="15" title="General">
            <Defs>
              <DefRow term="Changes to these terms">
                We date every version at the top of this page. The version that applies to
                your order is the one in force when you paid. We will not change the terms of
                an order after you have placed it.
              </DefRow>
              <DefRow term="Transferring this agreement">
                You may not transfer your rights under it without our written consent. We may
                transfer ours if our business is sold, and your rights are unaffected.
              </DefRow>
              <DefRow term="Third parties">
                Nobody other than you and us has any right to enforce these terms.
              </DefRow>
              <DefRow term="If a clause fails">
                If any part of these terms turns out to be unenforceable, the rest still
                applies.
              </DefRow>
              <DefRow term="Whole agreement">
                These terms and the Privacy Notice are the whole agreement between us about
                the pack. Nothing our marketing says overrides them &mdash; and if you find
                something on our website that contradicts this page, tell us, because one of
                them is wrong and we want to fix it.
              </DefRow>
              <DefRow term="Governing law">
                These terms are governed by the law of England and Wales, and the courts of
                England and Wales have exclusive jurisdiction.
              </DefRow>
              <DefRow term="Complaints">
                Email <a href="mailto:hello@readypack.co.uk">hello@readypack.co.uk</a> or use
                our <a href="/complaints">complaints form</a>. We acknowledge within five
                working days and respond within 30 days.
              </DefRow>
            </Defs>
          </LegalSection>

          <LegalSection
            id="data-processing"
            num="S1"
            title="Schedule 1 — Data processing terms"
          >
            <p>
              This schedule is the written contract required by Article 28(3) of the UK
              GDPR. It applies whenever you give us personal data about someone other than
              yourself &mdash; for example, naming a colleague as your AI governance contact.
              For that data <strong>you are the controller and we are your processor</strong>.
            </p>
            <Callout>
              <p>
                You do not need to send us your own data processing agreement or negotiate
                one before you buy. This schedule is already in force from the moment you
                accept these terms, and you can hand this page to a buyer who asks whether
                your supplier has a DPA in place.
              </p>
            </Callout>

            <h3 className={styles.h3}>S1.1 Scope of the processing</h3>
            <Defs>
              <DefRow term="Subject matter">
                Producing a tailored compliance documentation pack from the answers you give
                in our questionnaire.
              </DefRow>
              <DefRow term="Duration">
                From your first questionnaire answer until the data is deleted under the
                retention periods in our <a href="/privacy#how-long">Privacy Notice</a>, or
                earlier if you ask.
              </DefRow>
              <DefRow term="Nature and purpose">
                Collection, storage, organisation, use in generating documents (including
                submission to our AI sub-processor in the pseudonymised form described in our
                Privacy Notice), quality review by our personnel, delivery to you, and
                deletion.
              </DefRow>
              <DefRow term="Type of personal data">
                Names, job titles and business email addresses of individuals you identify in
                the questionnaire, and anything further you choose to type into the free-text
                fields. We ask you not to enter special category data.
              </DefRow>
              <DefRow term="Categories of data subject">
                Your personnel &mdash; principally the individuals you name as your
                governance or procurement policy owners &mdash; and any other individual you
                choose to mention.
              </DefRow>
            </Defs>

            <h3 className={styles.h3}>S1.2 Our obligations</h3>
            <p>We will:</p>
            <ol>
              <li>
                process the personal data only on your documented instructions, including on
                transfers out of the UK. These terms, the Privacy Notice and your use of the
                service are your instructions. If we are required by law to process it
                otherwise, we will tell you first unless the law forbids us from doing so;
              </li>
              <li>
                ensure that everyone we authorise to access the data is bound by a duty of
                confidence;
              </li>
              <li>
                take appropriate technical and organisational security measures as required by
                Article 32. The measures in place today are listed in{' '}
                <a href="/privacy#security">section 9 of our Privacy Notice</a>, and we keep
                that list accurate rather than aspirational;
              </li>
              <li>
                engage sub-processors only on the terms in S1.3 below;
              </li>
              <li>
                assist you, so far as we reasonably can, in responding to requests from
                individuals exercising their rights;
              </li>
              <li>
                assist you with your obligations on security, breach notification, data
                protection impact assessments and prior consultation, taking into account what
                we know and what we hold;
              </li>
              <li>
                notify you without undue delay, and in any event within 48 hours, if we become
                aware of a personal data breach affecting your data, with the detail you need
                to make your own notification;
              </li>
              <li>
                delete or return the personal data at the end of the processing, at your
                choice, unless we are legally required to keep it;
              </li>
              <li>
                make available the information you reasonably need to demonstrate compliance
                with Article 28, and allow and contribute to audits. In practice, ask us and we
                will answer &mdash; we would rather have the conversation than have you assume.
              </li>
            </ol>

            <h3 className={styles.h3}>S1.3 Sub-processors</h3>
            <p>
              You give us general authorisation to engage the sub-processors listed in{' '}
              <a href="/privacy#where">section 6 of our Privacy Notice</a>, which names each
              one, what it does and where it processes data. That list is the current list.
            </p>
            <p>
              We impose data protection obligations on each sub-processor that are no less
              protective than those in this schedule, and we remain fully liable to you for
              what they do.
            </p>
            <p>
              If we intend to add or replace a sub-processor we will update that page and
              email customers with an active order at least 30 days beforehand. You may
              object on reasonable data protection grounds. If we cannot resolve your
              objection, you may terminate and we will refund any amount you have paid for an
              undelivered pack.
            </p>

            <h3 className={styles.h3}>S1.4 International transfers</h3>
            <p>
              Some of our sub-processors process personal data outside the UK. The countries
              and the safeguards relied on are set out in{' '}
              <a href="/privacy#transfers">section 7 of our Privacy Notice</a>. You instruct
              us to make those transfers on those safeguards.
            </p>

            <h3 className={styles.h3}>S1.5 Your obligations</h3>
            <p>
              You confirm that you have a lawful basis for giving us the personal data, that
              you have told the individuals concerned what they need to be told, and that our
              processing on your instructions will not put you in breach of data protection
              law.
            </p>
          </LegalSection>
        </LegalDoc>
      </main>

      <Footer />
    </>
  )
}
