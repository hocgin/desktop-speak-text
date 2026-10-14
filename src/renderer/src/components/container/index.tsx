import clsx from 'clsx'
import React from 'react'
import styles from './index.module.css'

export function Container({ children, className }: any) {
  return <div className={clsx(styles.body, 'rounded-xl bg-card', className)}>{children}</div>
}
