import type { ReactNode } from 'react'
import styles from '../samples.module.css'

type DocTableProps = {
  headers: string[]
  rows: ReactNode[][]
  className?: string
}

export function DocTable({ headers, rows, className }: DocTableProps) {
  const tableClass = className
    ? `${styles['doc-table']} ${className}`
    : styles['doc-table']
  return (
    <table className={tableClass}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx}>
            {row.map((cell, cellIdx) => (
              <td key={cellIdx}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
