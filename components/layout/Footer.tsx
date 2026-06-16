import styles from '@/app/landing.module.css'
import { ReadyPackLogo } from '@/components/ReadyPackLogo'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles['footer-grid']}>
          <div className={styles['footer-brand']}>
            <a href="/" className={styles.logo} aria-label="ReadyPack">
              <ReadyPackLogo className={styles['logo-mark']} />
              <span className={styles['logo-word']} style={{ fontSize: 18 }}>
                ReadyPack
              </span>
            </a>
            <p>Compliance documentation for the businesses that need it most.</p>
            <div className={styles['footer-ico']}>ICO Registration: ZA-XXXXXX</div>
          </div>
          <div>
            <h4 className={styles['footer-col-title']}>Navigation</h4>
            <a className={styles['footer-link']} href="/#how">How It Works</a>
            <a className={styles['footer-link']} href="/#documents">The Documents</a>
            <a className={styles['footer-link']} href="/#pricing">Pricing</a>
            <a className={styles['footer-link']} href="/samples">Sample Documents</a>
            <a className={styles['footer-link']} href="/#faq">FAQ</a>
          </div>
          <div>
            <h4 className={styles['footer-col-title']}>Legal &amp; Contact</h4>
            <a className={styles['footer-link']} href="/privacy">Privacy Policy</a>
            <a className={styles['footer-link']} href="/terms">Terms of Service</a>
            <a className={styles['footer-link']} href="/complaints">
              Complaints Procedure
            </a>
            <a className={styles['footer-link']} href="mailto:hello@readypack.co.uk">
              hello@readypack.co.uk
            </a>
            <a className={styles['footer-link']} href="https://find-and-update.company-information.service.gov.uk/company/16633320" target="_blank" rel="noopener noreferrer">
              MOFE LTD · Registered in England
            </a>
          </div>
        </div>
        <div className={styles['footer-bottom']}>
          <div className={styles['fb-row']}>
            © 2026 ReadyPack · MOFE LTD · Registered in England &amp; Wales
          </div>
          <div className={styles['fb-row']}>
            ReadyPack is a compliance documentation support service. Nothing on this
            website constitutes legal advice. Documents are aligned with current ICO
            guidance and AI Act Article 50. For legal advice, consult a qualified
            solicitor. Complaints are handled under the statutory DUAA Section 103
            procedure — see <a className={styles['footer-link']} href="/complaints">Complaints Procedure</a>.
          </div>
        </div>
      </div>
    </footer>
  )
}
