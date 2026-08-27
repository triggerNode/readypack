'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

import styles from '../questions.module.css'

/**
 * The mechanism of the page: the reader ticks what they could answer today and
 * arrives at the gap on their own. Nothing is argued at them.
 *
 * Ticks are React state and nothing else. No fetch, no storage, no analytics
 * call. The "nothing is stored" line is only allowed to exist because that is
 * literally true here — an earlier version of the gap scan carried a similar
 * claim next to a table built to receive the data, and that is the mistake this
 * comment exists to stop anyone repeating. If you add a network call here, that
 * line has to come out in the same commit.
 */

type Group = {
  readonly id: string
  readonly heading: string
  readonly questions: readonly string[]
}

const GROUPS: readonly Group[] = [
  {
    id: 'what-you-use',
    heading: 'What you use, and who decided',
    questions: [
      'Which AI tools does your business use?',
      'Who approved each one, and when?',
      'Is there a written policy, and have your staff seen it?',
      'What happens when somebody wants to start using a new tool?',
    ],
  },
  {
    id: 'what-goes-in',
    heading: 'What goes into them',
    questions: [
      'Does any of our data go into an AI tool?',
      "Is our data used to train anybody's model?",
      'Where is it processed, and who else can see it?',
      'How long is it kept, and what happens when we ask you to delete it?',
    ],
  },
  {
    id: 'when-wrong',
    heading: 'When it gets something wrong',
    questions: [
      'Who checks AI output before it reaches us?',
      'What happens when it produces something incorrect?',
      'How would you tell us, and how quickly?',
      'Who is accountable when it goes wrong?',
    ],
  },
  {
    id: 'what-you-show',
    heading: 'What you can actually show',
    questions: [
      'Can you send us your AI policy?',
      'Do you keep a register of the tools you use?',
      'Have you written down the risks and what you do about them?',
      'If we ask again in a year, can you show us it is still current?',
    ],
  },
] as const

const TOTAL = GROUPS.reduce((n, g) => n + g.questions.length, 0)

export function Checklist() {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())

  const toggle = (key: string) => {
    setTicked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const count = ticked.size

  return (
    <div className={styles.card}>
      {GROUPS.map((group) => (
        <div key={group.id} className={styles.group}>
          <h2 className={styles.groupHeading}>{group.heading}</h2>
          <ul className={styles.list}>
            {group.questions.map((q, i) => {
              const key = `${group.id}-${i}`
              const on = ticked.has(key)
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={styles.row}
                    aria-pressed={on}
                    onClick={() => toggle(key)}
                  >
                    <span
                      className={on ? styles.boxOn : styles.box}
                      aria-hidden="true"
                    >
                      {on ? <Check width={13} height={13} strokeWidth={3.5} /> : null}
                    </span>
                    <span className={on ? styles.qOn : styles.q}>{q}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      <div className={styles.tally} aria-live="polite">
        <span className={styles.tallyCount}>
          {count} of {TOTAL}
        </span>
        <span className={styles.tallyLabel}>
          {count === 0
            ? 'Tick the ones you could answer today.'
            : count === TOTAL
              ? 'All of them. You are in a small minority, and you should say so when you bid.'
              : 'you could answer today. Nothing you tick is stored or sent anywhere.'}
        </span>
      </div>
    </div>
  )
}
