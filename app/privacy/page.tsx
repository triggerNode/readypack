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
  Region,
  type TocItem,
} from '@/components/legal/LegalDoc'
import styles from '../legal.module.css'

export const metadata = {
  title: 'Privacy Notice | ReadyPack',
  description:
    'What ReadyPack collects, what we send to the AI model that drafts your documents, where your data is stored, and how long we keep it.',
}

const TOC: readonly TocItem[] = [
  { id: 'who-we-are', label: 'Who we are' },
  { id: 'roles', label: 'Our two roles' },
  { id: 'what-we-collect', label: 'What we collect' },
  { id: 'why', label: 'Why we can use it' },
  { id: 'ai', label: 'What goes to the AI model' },
  { id: 'where', label: 'Where your data is' },
  { id: 'transfers', label: 'Data leaving the UK' },
  { id: 'how-long', label: 'How long we keep it' },
  { id: 'security', label: 'How we protect it' },
  { id: 'rights', label: 'Your rights' },
  { id: 'cookies', label: 'Cookies and tracking' },
  { id: 'prospects', label: 'If we emailed you' },
  { id: 'children', label: 'Children' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'changes', label: 'Changes to this notice' },
  { id: 'contact', label: 'Contact us' },
]

export default function PrivacyPage() {
  return (
    <>
      <TopTicker />
      <Nav />

      <main>
        <LegalDoc
          badge="Legal"
          title="Privacy Notice"
          standfirst="We sell compliance documentation, so we are going to be specific about our own. This notice says exactly what we collect, exactly what leaves our servers, and exactly how long we keep it."
          effective="27 July 2026"
          updated="27 July 2026"
          toc={TOC}
        >
          <ShortVersion
            note="This summary is here to help you find things. The numbered sections below are the notice itself."
          >
            <li>
              We collect what you type into the questionnaire, your email address, and
              your order record. Nothing else.
            </li>
            <li>
              Your documents are drafted by an AI model. Before your answers go to it, we
              swap your company name, your name, your role and your email for
              placeholders. Everything else you typed <strong>is</strong> sent, including
              the free text. A second AI model then checks the finished draft, and by that
              point your real name and details are back in it.
            </li>
            <li>
              The website runs in London and the database is in Ireland. The AI provider
              and our email provider are in the United States, and our payment provider
              transfers there too. Section 6 names all five and says where each one is.
            </li>
            <li>
              We use one cookie: the one that keeps you signed in. No analytics, no
              advertising, no tracking. That is why you never saw a cookie banner.
            </li>
            <li>
              Every pack is checked by an AI model and then released by a real person at
              ReadyPack, who may read your answers and your draft documents.
            </li>
            <li>
              You can ask for a copy of your data, or ask us to delete it, by emailing{' '}
              <a href="mailto:hello@readypack.co.uk">hello@readypack.co.uk</a>.
            </li>
          </ShortVersion>

          <LegalSection id="who-we-are" num="01" title="Who we are">
            <p>
              ReadyPack is a trading name of <strong>MOFE LTD</strong>, a company
              registered in England and Wales under company number{' '}
              <strong>16633320</strong>, with its registered office at First Floor, Swan
              Buildings, 20 Swan Street, Manchester M4 5JW.
            </p>
            <p>
              We are registered with the Information Commissioner&rsquo;s Office (ICO)
              under reference <strong>ZC100233</strong>. You can check both of those
              registrations yourself; we would rather you did.
            </p>
            <p>
              We have not appointed a Data Protection Officer. We are not required to have
              one: we are a small company, we do not monitor people on a large scale, and
              handling special category data is not a core part of what we do. Questions
              about this notice go to{' '}
              <a href="mailto:hello@readypack.co.uk">hello@readypack.co.uk</a> and are
              answered by a person, not a ticket system.
            </p>
          </LegalSection>

          <LegalSection id="roles" num="02" title="Our two roles">
            <p>
              Data protection law asks who decides what happens to personal data. For
              ReadyPack the answer depends on whose data it is, so we have two roles at
              once. This trips up a lot of suppliers, so here it is plainly.
            </p>

            <h3 className={styles.h3}>Most of the questionnaire is not personal data</h3>
            <p>
              Your sector, your headcount, which AI tools you use, what you use them for,
              which vendors you buy from &mdash; that is information about a business, not
              about a person. Data protection law does not apply to it at all. It is still
              confidential, and we still treat it that way, but it is worth knowing that
              the majority of what you tell us is not in scope.
            </p>

            <h3 className={styles.h3}>Your own details: we are the controller</h3>
            <p>
              Your email address, your name, your order and payment record, and the
              correspondence between us. We decided to collect these in order to sell you
              a pack and support you afterwards, so we are the controller and this notice
              is our explanation to you.
            </p>

            <h3 className={styles.h3}>
              Other people you name in the questionnaire: we are your processor
            </h3>
            <p>
              The questionnaire asks who owns AI governance at your company, and who owns
              your procurement policy. If you name a colleague and give their job title
              and email, that is personal data about them &mdash; and{' '}
              <strong>you</strong> decided to give it to us, not us. For that data your
              organisation is the controller and we act on your instructions only.
            </p>
            <p>
              The written processor terms required by Article 28 of the UK GDPR are in{' '}
              <a href="/terms#data-processing">Schedule 1 of our Terms of Service</a>. You
              already have them; you do not need to ask us for a separate data processing
              agreement, and you do not need to negotiate one before you buy.
            </p>
          </LegalSection>

          <LegalSection id="what-we-collect" num="03" title="What we collect">
            <h3 className={styles.h3}>When you buy</h3>
            <Defs>
              <DefRow term="Email address">
                Taken from the Stripe checkout. It becomes your account and it is where
                your pack is delivered.
              </DefRow>
              <DefRow term="Billing name and address">
                Collected by Stripe for the payment. We can see it in our Stripe account;
                we do not copy it into our own database.
              </DefRow>
              <DefRow term="Payment record">
                Which pack you bought, the amount, the date, and Stripe&rsquo;s reference
                numbers for the payment.
              </DefRow>
              <DefRow term="Card details">
                <strong>Never.</strong> Payment happens on Stripe&rsquo;s own checkout
                page. Your card number is never sent to us and never touches our servers.
              </DefRow>
            </Defs>

            <h3 className={styles.h3}>When you fill in the questionnaire</h3>
            <p>
              The questionnaire has ten sections. In order, it collects:
            </p>
            <ol>
              <li>
                <strong>Your business</strong> &mdash; company name, trading name, company
                number, sector, employee count, and your logo if you upload one.
              </li>
              <li>
                <strong>Markets and customers</strong> &mdash; where your customers are,
                what proportion are in the EU, what type they are and which sectors.
              </li>
              <li>
                <strong>AI tools</strong> &mdash; which tools you use, what you use each
                one for (including anything you type in yourself), and whether customers
                come into contact with them.
              </li>
              <li>
                <strong>How AI is used</strong> &mdash; whether it makes or informs
                decisions, what kinds of decision, whether it faces customers and through
                which channels, and whether children&rsquo;s data is involved.
              </li>
              <li>
                <strong>AI and people</strong> &mdash; what you currently tell people
                about your AI use, the exact wording you use, and whether there is a way
                to opt out.
              </li>
              <li>
                <strong>Data and vendors</strong> &mdash; the categories of data your AI
                tools handle, and for each vendor: their name, where they are based,
                whether you have a data processing agreement with them, the transfer
                mechanism, whether they reuse your data for training, and their
                certifications.
              </li>
              <li>
                <strong>Existing documents</strong> &mdash; who owns AI governance,{' '}
                <strong>including that person&rsquo;s name, job title and email</strong>,
                and whether you already have a record of processing, a DPIA or an AI
                policy.
              </li>
              <li>
                <strong>Complaints and incidents</strong> &mdash; whether you have a
                complaints procedure, whether you have had complaints, any detail you
                choose to write, and any contact with the ICO.
              </li>
              <li>
                <strong>Procurement</strong> &mdash; why you are buying, the client or
                tender you are targeting and its deadline, who owns the policy, and any
                additional context you want to add.
              </li>
              <li>
                <strong>Review and submit</strong> &mdash; your confirmation that the
                answers are accurate.
              </li>
            </ol>

            <Callout tone="warn">
              <p>
                <strong>Two of those sections have open text boxes.</strong> Section 8
                asks about past complaints and section 9 asks for additional context.
                Please do not type anything into them that identifies a specific
                individual &mdash; a complainant&rsquo;s name, a health detail, an
                employee dispute. We do not need it to build your pack, and the free text
                is the part that is sent to the AI provider (see section 5).
              </p>
            </Callout>

            <p>
              Section 6 asks you to tick which <em>categories</em> of data your AI tools
              handle, and some of those are special category data &mdash; health,
              biometrics, ethnicity, beliefs, sexual orientation, children&rsquo;s data.
              To be clear: we are asking you to describe your business. We are not asking
              for, and do not want, the underlying records themselves.
            </p>

            <h3 className={styles.h3}>Automatically, while you use the site</h3>
            <Defs>
              <DefRow term="Sign-in cookie">
                Set when you open your magic link, so you stay signed in while you work
                through the questionnaire.
              </DefRow>
              <DefRow term="Your IP address">
                Held in memory for up to fifteen minutes to stop somebody hammering the
                sign-in and checkout forms. It is not written to our database.
              </DefRow>
              <DefRow term="Server logs">
                Our hosting provider keeps ordinary web server logs, which include IP
                addresses, briefly and for security. We deliberately do not write your
                email address or your answers into application logs, and we do not copy
                the provider&rsquo;s logs into our own systems.
              </DefRow>
            </Defs>
          </LegalSection>

          <LegalSection id="why" num="04" title="Why we can use it">
            <p>
              For each thing we do with your personal data, here is the lawful basis we
              rely on.
            </p>
            <TableWrap>
              <thead>
                <tr>
                  <th scope="col">What we do</th>
                  <th scope="col">Why we are allowed to</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Take your order and deliver your pack</td>
                  <td>
                    Performance of our contract with you. Without your email and your
                    answers there is no pack.
                  </td>
                </tr>
                <tr>
                  <td>Send you your magic link, submission confirmation and delivery</td>
                  <td>Performance of our contract with you.</td>
                </tr>
                <tr>
                  <td>Answer your questions and handle a refund</td>
                  <td>Performance of our contract with you.</td>
                </tr>
                <tr>
                  <td>Keep order and payment records</td>
                  <td>
                    Legal obligation. UK company and tax law requires us to keep
                    accounting records.
                  </td>
                </tr>
                <tr>
                  <td>Keep an internal log of what our admin users did</td>
                  <td>
                    Legitimate interests &mdash; being able to show who touched a customer
                    case, which is what any buyer auditing us would expect.
                  </td>
                </tr>
                <tr>
                  <td>Rate limiting and abuse prevention</td>
                  <td>Legitimate interests &mdash; keeping the service up and secure.</td>
                </tr>
                <tr>
                  <td>Contact a business prospect who has not bought from us</td>
                  <td>
                    Legitimate interests. See <a href="#prospects">section 12</a>, which
                    explains this in full.
                  </td>
                </tr>
                <tr>
                  <td>Handle a complaint</td>
                  <td>
                    Legal obligation under the Data (Use and Access) Act 2025, section
                    103.
                  </td>
                </tr>
              </tbody>
            </TableWrap>

            <h3 className={styles.h3}>Automated scoring</h3>
            <p>
              When you submit, your answers are scored automatically to decide whether
              your pack needs a closer manual look before it goes out. That is a decision
              about a document, not about you as a person, and it never has a legal effect
              on anybody. A person at ReadyPack makes the final call on every pack before
              it is delivered.
            </p>
          </LegalSection>

          <LegalSection id="ai" num="05" title="What goes to the AI model">
            <p>
              Your documents are drafted and then checked by AI models provided by{' '}
              <strong>Anthropic PBC</strong>. There are two separate AI steps, they are not
              given the same thing, and this is the section people actually want to read
              &mdash; so we are going to be exact rather than reassuring.
            </p>

            <Callout>
              <p>
                Before your answers are sent to the AI model that drafts your documents,
                we replace your company name, your name, your role and your email with
                placeholders, and put them back afterwards. The model provider does not
                train its models on your data.
              </p>
            </Callout>

            <h3 className={styles.h3}>Step one: drafting. What is swapped out</h3>
            <p>
              Seven fields are replaced with placeholders before the drafting request
              leaves our servers, and the real values are put back into the finished
              document afterwards: your company name, your trading name, your contact
              name, your contact role, your contact email, and the two dates printed on
              the pack.
            </p>

            <h3 className={styles.h3}>Step one: drafting. What is sent</h3>
            <p>
              Everything else in your questionnaire. Specifically: your sector and
              headcount, the names of every AI tool you listed, the names of your vendors,
              what you told us each tool is used for, the categories of data involved, the
              risk flags our checks raised and the explanations behind them, and &mdash;
              on the Procurement-Ready tier and on any agreed multi-client arrangement
              &mdash; the free text you wrote about the tender or client you are chasing.
            </p>
            <p>
              We are spelling this out because at the drafting step the swap covers who
              you are, not what you said. If you would not want a sentence processed by a
              third-party AI provider, do not type it into the questionnaire.
            </p>

            <h3 className={styles.h3}>Step two: the check</h3>
            <p>
              Once a draft comes back, a second AI model from the same provider reads it
              and scores it for completeness, risk, and contradictions between your
              documents. That score is what decides whether a pack can be released or has
              to be held back for a closer look.
            </p>
            <p>
              <strong>
                This second model does see your real company name, contact name, role and
                email.
              </strong>{' '}
              Not because we send your answers a second time &mdash; that copy is
              swapped for placeholders too &mdash; but because what it is given is the
              finished draft, and by that point the real values have been put back in. It
              is the same provider, under the same contract, with the same no-training and
              retention position set out below. We are telling you rather than letting the
              paragraph above imply your name never reaches them at all.
            </p>

            <h3 className={styles.h3}>What Anthropic does with it</h3>
            <ul>
              <li>Anthropic acts as our processor and only uses the data to return a draft.</li>
              <li>Your data is not used to train their models.</li>
              <li>
                On the commercial API we use, conversation content is not retained by
                default.
              </li>
              <li>
                Content that Anthropic&rsquo;s trust and safety systems flag can be
                retained by them for up to two years. We are telling you this rather than
                leaving it out.
              </li>
              <li>Anthropic stores data in the United States.</li>
            </ul>

            <h3 className={styles.h3}>The person who releases it</h3>
            <p>
              The check above is automated. A person is the next step, not the same one:
              where your answers flag something higher risk or uncertain the pack is held
              for a closer manual review, and no pack reaches you until someone at
              ReadyPack releases it. That means{' '}
              <strong>
                a person at ReadyPack may read your answers and your draft documents
              </strong>
              . Every time an admin user opens a customer case, that is recorded in our
              internal log.
            </p>
          </LegalSection>

          <LegalSection id="where" num="06" title="Where your data is">
            <p>
              We use five suppliers. Here is every one of them, what it does, and where it
              handles your data.
            </p>
            <TableWrap>
              <thead>
                <tr>
                  <th scope="col">Supplier</th>
                  <th scope="col">What it does for us</th>
                  <th scope="col">Where</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Vercel Inc.</td>
                  <td>Runs the website and the application code</td>
                  <td>
                    <Region where="uk" />
                  </td>
                </tr>
                <tr>
                  <td>Supabase Inc.</td>
                  <td>
                    Database, sign-in, and storage for your logo and your finished
                    documents
                  </td>
                  <td>
                    <Region where="eu" />
                  </td>
                </tr>
                <tr>
                  <td>Anthropic PBC</td>
                  <td>The AI model that drafts your documents</td>
                  <td>
                    <Region where="us" />
                  </td>
                </tr>
                <tr>
                  <td>Resend</td>
                  <td>Sends our emails, including your magic link and your pack</td>
                  <td>
                    <Region where="us" />
                  </td>
                </tr>
                <tr>
                  <td>Stripe</td>
                  <td>Takes payment and holds the billing record</td>
                  <td>
                    <Region where="uk" /> <Region where="us" />
                  </td>
                </tr>
              </tbody>
            </TableWrap>
            <p>
              Your answers and your finished documents live in the database in Ireland.
              They are read by the application in London and, in the form described in{' '}
              <a href="#ai">section 5</a>, by the AI provider in the United States. Nobody
              else receives them.
            </p>
            <p>
              We do not sell your data, we do not share it with advertisers or data
              brokers, and we do not use it to build a product for anyone other than you.
              If we are ever legally compelled to hand something over, we will tell you
              unless we are prohibited from doing so.
            </p>
          </LegalSection>

          <LegalSection id="transfers" num="07" title="Data leaving the UK">
            <p>
              Three of our suppliers process personal data outside the UK: Anthropic and
              Resend in the United States, and Stripe, which transfers to the United
              States and India as part of running a global payments network. Supabase
              stores our database in Ireland, which is covered by the UK&rsquo;s adequacy
              finding for the EEA.
            </p>
            <p>
              Every one of these suppliers is engaged under a written data processing
              agreement that contains the safeguards approved for international transfers.
              Specifically:
            </p>
            <ul>
              <li>
                <strong>Anthropic</strong> &mdash; their data processing addendum, which
                incorporates the European Commission&rsquo;s Standard Contractual Clauses,
                forms part of the commercial terms our account is on.
              </li>
              <li>
                <strong>Stripe</strong> &mdash; relies on the Standard Contractual
                Clauses, the UK International Data Transfer Addendum issued by the ICO,
                and the UK Extension to the EU&ndash;US Data Privacy Framework.
              </li>
              <li>
                <strong>Resend and Vercel</strong> &mdash; each engaged under their
                standard data processing agreement covering transfers out of the UK and
                EEA.
              </li>
            </ul>
            <p>
              You can ask us for a copy of the relevant terms and we will point you
              straight at them.
            </p>
          </LegalSection>

          <LegalSection id="how-long" num="08" title="How long we keep it">
            <Defs>
              <DefRow term="Questionnaire answers">
                24 months from the date your pack is delivered, so that you can ask for a
                re-issue or a revision. Then deleted.
              </DefRow>
              <DefRow term="Your finished documents and logo">
                24 months from delivery, so you can download them again from your portal.
                Then deleted. Download and keep your own copy.
              </DefRow>
              <DefRow term="Account and order records">
                7 years from the end of the financial year the order falls in. UK company
                and tax law requires this and we cannot shorten it.
              </DefRow>
              <DefRow term="Email delivery records">
                24 months. These record that an email was sent, to whom and whether it
                arrived &mdash; not its contents.
              </DefRow>
              <DefRow term="Internal admin log">24 months.</DefRow>
              <DefRow term="Complaints">
                6 years from the date the complaint is closed, because a complaint can
                become a legal claim.
              </DefRow>
              <DefRow term="Prospect contact details">
                12 months from the last time we contacted you, or immediately if you tell
                us to stop.
              </DefRow>
            </Defs>
            <p>
              Deletion is carried out by us on a scheduled review of the records that have
              passed their retention date, and straight away when you ask. We are
              describing what we do, not an automatic process that runs without anybody
              looking &mdash; if you want your data gone on a particular date, email us
              and we will confirm when it is done.
            </p>
          </LegalSection>

          <LegalSection id="security" num="09" title="How we protect it">
            <ul>
              <li>Everything between your browser and our servers is encrypted (HTTPS).</li>
              <li>
                Your finished documents sit in private storage. The download links we hand
                out are signed and expire after one hour, so a forwarded link stops working.
              </li>
              <li>
                Sign-in is by one-time link sent to your email address. There is no
                password on your account, so there is no password to be stolen or reused.
              </li>
              <li>
                The database enforces row-level separation, so one customer&rsquo;s
                account cannot read another&rsquo;s records.
              </li>
              <li>
                Admin access to customer answers is restricted to us and every case view
                is logged.
              </li>
              <li>
                Secrets and API keys are held as environment variables, never in our source
                code.
              </li>
            </ul>

            <Callout tone="warn">
              <p>
                <strong>One deliberate exception.</strong> If you upload a logo, it is
                stored in a public bucket, because it has to be fetched and printed onto
                your documents. Anyone who knows the URL can view it. That is fine for a
                logo, which you publish anyway &mdash; but do not upload anything
                confidential to that field.
              </p>
            </Callout>

            <p>
              We do not hold ISO 27001 or SOC 2 certification, and we are not going to
              imply otherwise. We are a small company using well-established providers, and
              the controls above are the honest description of what protects your data
              today. No system is perfectly secure; if we ever suffer a breach that is
              likely to put you at risk, we will tell you and the ICO within the statutory
              deadlines.
            </p>
          </LegalSection>

          <LegalSection id="rights" num="10" title="Your rights">
            <p>Under UK data protection law you can ask us to:</p>
            <ul>
              <li>
                <strong>Give you a copy</strong> of the personal data we hold about you.
              </li>
              <li>
                <strong>Correct it</strong> if it is wrong or incomplete.
              </li>
              <li>
                <strong>Delete it</strong>, where we do not have a legal reason to keep it.
              </li>
              <li>
                <strong>Restrict what we do with it</strong> while a dispute is resolved.
              </li>
              <li>
                <strong>Hand it over</strong> to you or another provider in a portable
                format.
              </li>
              <li>
                <strong>Stop</strong> processing based on legitimate interests, including
                all marketing, at any time.
              </li>
            </ul>
            <p>
              Email <a href="mailto:hello@readypack.co.uk">hello@readypack.co.uk</a>. We
              respond within one month, free of charge. We may ask you to confirm your
              identity first &mdash; that is us protecting your data, not us stalling.
            </p>
            <Callout>
              <p>
                If your request is about personal data that <em>another</em> ReadyPack
                customer entered about you &mdash; for example, your name appeared in
                their questionnaire as their governance contact &mdash; ask them first.
                They are the controller for that data and we act on their instructions.
                Tell us anyway and we will help them respond.
              </p>
            </Callout>
          </LegalSection>

          <LegalSection id="cookies" num="11" title="Cookies and tracking">
            <p>
              We use <strong>one kind of cookie</strong>: the session cookie that keeps you
              signed in after you open your magic link. Without it you would be logged out
              between questionnaire sections. It is strictly necessary, so it does not
              require your consent.
            </p>
            <p>That is the complete list. To be specific about what we do not do:</p>
            <ul>
              <li>No analytics of any kind. We do not know which pages you visited.</li>
              <li>No advertising or remarketing tags.</li>
              <li>No tracking pixels, in the website or in our emails.</li>
              <li>No session recording or heatmaps.</li>
              <li>No third-party scripts running on our pages.</li>
              <li>
                Our fonts are served from our own domain rather than fetched from Google,
                so loading a ReadyPack page does not tell anybody else that you were here.
              </li>
            </ul>
            <p>
              This is why you have never seen a cookie banner on this site. There is
              nothing to consent to. We would rather have that than a pop-up.
            </p>
          </LegalSection>

          <LegalSection id="prospects" num="12" title="If we emailed you and you are not a customer">
            <p>
              We approach a small number of businesses directly. If you received an email
              from us out of the blue, this section is the one that applies to you, and it
              is the answer to &ldquo;where did you get my details?&rdquo;
            </p>

            <h3 className={styles.h3}>What we hold</h3>
            <p>
              Your name, your job title, your work email address, your employer, and a note
              of where we found each of those.
            </p>

            <h3 className={styles.h3}>Where we got it</h3>
            <p>
              Public sources only: your company&rsquo;s own website, Companies House,
              Contracts Finder or another public tender notice, or your public LinkedIn
              profile. We do not buy lists and we do not use email-guessing tools.
            </p>

            <h3 className={styles.h3}>Why we are allowed to</h3>
            <p>
              Legitimate interests. We offer a business service to businesses that are
              likely to be asked about their AI use by their own customers, and contacting
              a named person in a relevant role at a limited company is a proportionate way
              to do that. We have weighed our interest against your privacy: the message
              goes to a work address, it is about your professional role, it is sent by a
              named person one at a time rather than by a bulk tool, and it always offers a
              way to stop.
            </p>
            <p>
              We only contact people at limited companies. We do not cold-email sole
              traders or ordinary partnerships, because the marketing rules treat them as
              individuals and that would require your consent, which we do not have.
            </p>

            <h3 className={styles.h3}>How to make it stop</h3>
            <p>
              Reply and say so, in any words you like, or email{' '}
              <a href="mailto:hello@readypack.co.uk">hello@readypack.co.uk</a>. We remove
              you the same day and we do not need a reason. If you would rather we deleted
              your details entirely rather than keeping a note not to contact you again,
              say that and we will.
            </p>
            <p>
              If you never reply, we delete your details 12 months after the last time we
              contacted you.
            </p>
          </LegalSection>

          <LegalSection id="children" num="13" title="Children">
            <p>
              ReadyPack is a business-to-business service and is not intended for anyone
              under 18. We do not knowingly collect personal data about children. The
              questionnaire asks whether <em>your</em> AI tools handle children&rsquo;s
              data, because that changes what your pack has to say &mdash; it does not ask
              you to give us any.
            </p>
          </LegalSection>

          <LegalSection id="complaints" num="14" title="Complaints">
            <p>
              If you are unhappy with how we have handled your data, tell us first. Email{' '}
              <a href="mailto:hello@readypack.co.uk">hello@readypack.co.uk</a> or use our{' '}
              <a href="/complaints">complaints form</a>. We acknowledge within five working
              days and give you a substantive response within 30 days, which is the
              deadline set by section 103 of the Data (Use and Access) Act 2025.
            </p>
            <p>
              If we do not resolve it, you can complain to the Information
              Commissioner&rsquo;s Office. You do not have to come to us first, but we
              would like the chance to fix it.
            </p>
            <div className={styles.contactCard}>
              <p>
                <strong>Information Commissioner&rsquo;s Office</strong>
                <br />
                Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF
              </p>
              <p>
                Helpline 0303 123 1113 &middot;{' '}
                <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer">
                  ico.org.uk/make-a-complaint
                </a>
              </p>
            </div>
          </LegalSection>

          <LegalSection id="changes" num="15" title="Changes to this notice">
            <p>
              We date every version of this notice at the top. If we change something that
              materially affects how we handle your data &mdash; a new supplier, a new
              purpose, a longer retention period &mdash; we will email customers with an
              active order rather than quietly updating the page.
            </p>
          </LegalSection>

          <LegalSection id="contact" num="16" title="Contact us">
            <div className={styles.contactCard}>
              <p>
                <strong>MOFE LTD</strong>, trading as ReadyPack
                <br />
                First Floor, Swan Buildings, 20 Swan Street, Manchester M4 5JW
              </p>
              <p>
                Company number 16633320 &middot; ICO registration ZC100233
                <br />
                <a href="mailto:hello@readypack.co.uk">hello@readypack.co.uk</a>
              </p>
            </div>
            <p className={styles.docFoot}>
              ReadyPack produces documentation. It is not legal, tax or regulatory advice.
              Where you need advice on your specific circumstances, engage a qualified
              solicitor or accountant. See our{' '}
              <a href="/terms">Terms of Service</a> for the full position.
            </p>
          </LegalSection>
        </LegalDoc>
      </main>

      <Footer />
    </>
  )
}
