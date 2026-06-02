// TODO: implement in Stage 3 — landing page
export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--sp-8)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontSize: 'var(--h1)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 'var(--sp-4)',
          }}
        >
          ReadyPack
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--body-lg)' }}>
          AI compliance documentation — coming soon.
        </p>
      </div>
    </main>
  )
}
