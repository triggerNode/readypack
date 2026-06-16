type Props = {
  eyebrow: string
  heading: string
  description: string
}

export function SectionHeader({ eyebrow, heading, description }: Props) {
  return (
    <>
      <div className="qz-eyebrow">{eyebrow}</div>
      <h2 className="qz-h2">{heading}</h2>
      <p className="qz-sec-desc">{description}</p>
      <div className="qz-sec-divider" />
    </>
  )
}
