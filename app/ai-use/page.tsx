import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { TopTicker } from '@/components/layout/TopTicker'
import {
  LegalDoc,
  LegalSection,
  ShortVersion,
  Callout,
  TableWrap,
  type TocItem,
} from '@/components/legal/LegalDoc'
import styles from '../legal.module.css'

export const metadata = {
  title: 'AI Use Statement | ReadyPack',
  description:
    'Which AI systems ReadyPack uses, what they are used for, who checks the output, and where we sit under the EU AI Act and UK GDPR. This is the document we sell, published about ourselves.',
}

const TOC: readonly TocItem[] = [
  { id: 'scope', label: 'Who this covers' },
  { id: 'systems', label: 'The AI systems we use' },
  { id: 'two-roles', label: 'We are both a user and a provider' },
  { id: 'oversight', label: 'Who checks the output' },
  { id: 'not-in-use', label: 'What we do NOT use AI for' },
  { id: 'data', label: 'What we put into AI tools' },
  { id: 'review', label: 'When this is reviewed' },
  { id: 'contact', label: 'Contact' },
]

export default function AiUsePage() {
  return (
    <>
      <TopTicker />
      <Nav />

      <main>
        <LegalDoc
          badge="Our own pack"
          title="AI Use Statement"
          standfirst="We sell a pack that documents how a business uses AI. It would be a poor advertisement if we did not publish our own. This is ReadyPack's, produced by ReadyPack, and every claim in it has been checked against what our code actually does."
          effective="5 August 2026"
          updated="5 August 2026"
          toc={TOC}
        >
          <ShortVersion note="This summary is here to help you find things. The numbered sections below are the statement itself.">
            <li>
              We use <strong>one AI vendor</strong>, Anthropic, and two of their
              Claude models. Nothing else.
            </li>
            <li>
              We use AI for two separate things: <strong>drafting our customers&rsquo;
              documents</strong>, and ordinary internal work like writing and code.
            </li>
            <li>
              Every pack is drafted by one AI model, checked by a second, and then{' '}
              <strong>released by a person</strong>. No pack reaches a customer
              without someone at ReadyPack releasing it.
            </li>
            <li>
              We use <strong>no high-risk AI</strong> as the EU AI Act defines it.
              Nothing touching recruitment, credit, biometrics, policing or access
              to essential services.
            </li>
            <li>
              We are unusual among our own customers: we are both a business that{' '}
              <strong>uses</strong> AI and one whose <strong>product</strong> runs
              on it. Section 3 says so plainly rather than hiding it.
            </li>
          </ShortVersion>

          <LegalSection id="scope" num="01" title="Who this covers">
            <p>
              This statement is published by <strong>MOFE LTD</strong> (Company
              Number 16633320), trading as ReadyPack. It covers every AI system used
              in running the business and in delivering our product.
            </p>
            <p>
              It exists to answer three audiences without them having to ask: business
              customers who want to know how their documents were produced, a
              procurement or compliance team assessing us as a supplier, and a
              regulator asking for evidence. It is written to meet the transparency
              duty in Article 50 of the EU AI Act (Regulation 2024/1689) and the
              information duties in Articles 13 and 14 of the UK GDPR.
            </p>
            <p>
              We sell to UK businesses and do not currently have customers in the
              European Union.
            </p>
          </LegalSection>

          <LegalSection id="systems" num="02" title="The AI systems we use">
            <p>
              One vendor, two models. We have deliberately kept this short, because a
              long list would mean a larger surface to govern than a business this
              size can honestly govern.
            </p>

            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>System</th>
                    <th>Vendor</th>
                    <th>What we use it for</th>
                    <th>EU AI Act class</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Claude Sonnet 4.6</td>
                    <td>Anthropic PBC</td>
                    <td>
                      Drafting the documents in a customer&rsquo;s pack, and revising
                      them when a customer asks for changes
                    </td>
                    <td>Limited risk (Art. 50)</td>
                  </tr>
                  <tr>
                    <td>Claude Haiku 4.5</td>
                    <td>Anthropic PBC</td>
                    <td>
                      Checking a finished draft for completeness, risk and
                      contradictions between documents, and answering customer
                      questions about their own pack
                    </td>
                    <td>Limited risk (Art. 50)</td>
                  </tr>
                  <tr>
                    <td>Claude (general use)</td>
                    <td>Anthropic PBC</td>
                    <td>
                      Ordinary internal work: writing, research and software
                      development
                    </td>
                    <td>Limited risk (Art. 50)</td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>

            <p>
              Anthropic is our only AI vendor. We have a data processing agreement
              with them. They do not train their models on data we send, and on the
              commercial interface we use, conversation content is not retained by
              default. Content their trust-and-safety systems flag can be retained by
              them for up to two years, and we say so rather than leave it out.
            </p>
          </LegalSection>

          <LegalSection id="two-roles" num="03" title="We are both a user and a provider">
            <Callout>
              <p>
                Most businesses that buy this pack are AI <strong>users</strong> —
                they use tools someone else built. We are that, but we are also a
                business whose <strong>product</strong> runs on AI. Those are
                different obligations, and it would be misleading to publish a
                statement that only covered the first.
              </p>
            </Callout>
            <p>
              <strong>As a user</strong>, our position is the ordinary one described
              in section 2: a small set of tools, human accountability, no high-risk
              use.
            </p>
            <p>
              <strong>As a provider</strong>, our customers&rsquo; questionnaire
              answers are processed by an AI model in order to produce their
              documents. That is the product working as sold, not an incidental use,
              and it deserves more than a line in a statement like this. It is set out
              in full in{' '}
              <a href="/privacy#ai">section 5 of our Privacy Notice</a>: exactly which
              fields are swapped for placeholders before drafting, exactly what is
              sent, what the second model receives, and what Anthropic does with it.
            </p>
            <p>
              If you are assessing us as a supplier, section 5 of the Privacy Notice
              and Schedule 1 of our <a href="/terms">Terms</a> — a full Article 28
              data processing agreement — are the two documents you actually want.
            </p>
          </LegalSection>

          <LegalSection id="oversight" num="04" title="Who checks the output">
            <p>
              Three steps, and we describe them precisely because a vaguer description
              would flatter us.
            </p>
            <ol>
              <li>
                <strong>An AI model drafts</strong> each document from the
                customer&rsquo;s answers.
              </li>
              <li>
                <strong>A second AI model checks it</strong> — scoring completeness
                and risk, and looking for contradictions between the documents. This
                step is automated. It is not a person.
              </li>
              <li>
                <strong>A person at ReadyPack releases it.</strong> No pack reaches a
                customer until someone here does that, and where the answers flag
                something higher-risk or uncertain the pack is held for a closer look
                first.
              </li>
            </ol>
            <p>
              <strong>Olu Adebiyi, Director</strong>, holds accountability for AI
              governance in the business, for keeping this statement current, and for
              acting on any concern raised about an AI output. The business has fewer
              than ten people, so that accountability is direct rather than delegated
              through a hierarchy.
            </p>
            <p>
              Every time an administrator opens a customer case, it is recorded in our
              internal log.
            </p>
          </LegalSection>

          <LegalSection id="not-in-use" num="05" title="What we do NOT use AI for">
            <p>
              We deploy no AI system falling within the high-risk categories in Annex
              III of the EU AI Act, and no prohibited practice under Article 5.
              Specifically, we do not use AI for:
            </p>
            <ul>
              <li>biometric identification or categorising people</li>
              <li>recruitment, or any decision about someone&rsquo;s employment</li>
              <li>
                deciding access to essential services such as credit, insurance or
                housing
              </li>
              <li>educational assessment</li>
              <li>law enforcement, or the administration of justice</li>
              <li>
                any decision made solely by a machine that produces a legal or
                similarly significant effect on a person
              </li>
            </ul>
            <p>
              The pack we produce is a document about a business, not a decision about
              a person. We re-check this at every review, and immediately if what we
              use AI for changes.
            </p>
          </LegalSection>

          <LegalSection id="data" num="06" title="What we put into AI tools">
            <p>
              For <strong>internal</strong> use, staff are instructed not to put
              customer personal data, confidential client material or special category
              data into a general-purpose AI chat. Internal use is for writing,
              research and code.
            </p>
            <p>
              For the <strong>product</strong>, the position is different and is
              deliberately not summarised here, because a summary would blur it. Seven
              identity fields are replaced with placeholders before the drafting
              request leaves our servers; everything else in the questionnaire is
              sent, including free text; and the second, checking model receives the
              finished draft with the real details restored.{' '}
              <a href="/privacy#ai">Section 5 of the Privacy Notice</a> sets out each
              of those in full, field by field.
            </p>
          </LegalSection>

          <LegalSection id="review" num="07" title="When this is reviewed">
            <p>
              Annually, with the next scheduled review due{' '}
              <strong>5 August 2027</strong>. It is also reviewed immediately, without
              waiting for that date, if any of the following happens:
            </p>
            <ul>
              <li>we adopt a new AI tool or vendor</li>
              <li>
                an existing tool materially changes what it does, how it processes
                data, or its risk classification
              </li>
              <li>there is a security incident involving an AI tool</li>
              <li>a customer complains about an AI-assisted output</li>
              <li>the law or regulatory guidance changes</li>
            </ul>
            <p>
              Olu Adebiyi is responsible for starting each review and for reissuing
              this statement.
            </p>
          </LegalSection>

          <LegalSection id="contact" num="08" title="Contact">
            <p>
              Questions about how we use AI, or a request for the internal evidence
              behind this statement — our AI risk register, DPIA, vendor register and
              internal AI policy, which we produce on request rather than publish:{' '}
              <a href="mailto:hello@readypack.co.uk">hello@readypack.co.uk</a>.
            </p>
            <p className={styles.docFoot}>
              ReadyPack is a trading name of MOFE LTD (Company Number 16633320). This
              statement describes our own AI use. It is not legal advice. Where you
              need advice on your own circumstances, engage a qualified solicitor.
            </p>
          </LegalSection>
        </LegalDoc>
      </main>

      <Footer />
    </>
  )
}
