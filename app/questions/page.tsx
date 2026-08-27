import type { Metadata } from 'next'
import Link from 'next/link'

import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { Checklist } from './_components/Checklist'
import styles from './questions.module.css'

/**
 * The free resource behind the LinkedIn Featured section.
 *
 * Deliberately gives everything away and asks for nothing: no email, no form,
 * no price on the page. The only route onward is /samples, because somebody
 * reading a free list is one step into curiosity, not one step from paying.
 *
 * Server component so the metadata below is emitted. LinkedIn reads these tags
 * to build the Featured card preview, so they are load-bearing, not decoration.
 */

export const metadata: Metadata = {
  // The root layout appends " · ReadyPack" via its title template, so the brand
  // is deliberately not repeated here.
  title: 'The questions buyers actually ask',
  description:
    'The AI questions that turn up in supplier due diligence forms sent to small UK firms. Free, nothing to fill in. Read them the way your client will.',
  openGraph: {
    title: 'The questions buyers actually ask',
    description:
      'The AI questions that turn up in supplier due diligence forms sent to small UK firms. Free, nothing to fill in.',
    type: 'article',
  },
}

export default function QuestionsPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.container}>
            <p className={styles.eyebrow}>Free, and there is nothing to fill in</p>
            <h1 className={styles.title}>The questions buyers actually ask</h1>
            <p className={styles.lede}>
              These turn up in supplier due diligence forms, security
              questionnaires and procurement packs sent to small UK businesses.
              They are not hypothetical and they are not ours. They are the
              questions our document set exists to answer.
            </p>
            <p className={styles.instruction}>
              Read them the way your client will. Not{' '}
              <em>could I find this out</em>, but{' '}
              <strong>could I send an answer this afternoon.</strong>
            </p>
          </div>
        </section>

        <section className={styles.body}>
          <div className={styles.container}>
            <Checklist />

            <div className={styles.landing}>
              <p className={styles.landingLead}>
                Most firms can answer the first question in each group and stall
                on the rest.
              </p>
              <p className={styles.landingBody}>
                That is not a failure of practice. Small firms are usually careful
                about this. It is that nobody wrote any of it down, so the answers
                live in one or two people&apos;s heads and cannot be sent to
                anybody.
              </p>
              <p className={styles.landingBody}>
                If you went through that list and there were four or five you
                would have to go away and find out, that is the gap.
              </p>
              <Link href="/samples" className={styles.next}>
                See what the answers look like written down
                <span aria-hidden="true" className={styles.nextArrow}>
                  →
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
