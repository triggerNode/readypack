import styles from '../samples.module.css'

type SnippetCardProps = {
  label: string
  tag: string
  body: string
}

export function SnippetCard({ label, tag, body }: SnippetCardProps) {
  return (
    <div className={styles['snippet-card']}>
      <div className={styles['snippet-head']}>
        <span className={styles['snippet-label']}>{label}</span>
        <span className={styles['snippet-tag']}>{tag}</span>
      </div>
      <pre className={styles['snippet-body']}>{body}</pre>
    </div>
  )
}
