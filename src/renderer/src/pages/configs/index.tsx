import React from 'react'
import styles from './index.module.css'
import { Container } from '@/renderer/components/container/index.js'
import clsx from 'clsx'

function ConfigsPage(): React.JSX.Element {
  return <Container className={clsx(styles.body)}>
    ConfigsPage
  </Container>
}

export default ConfigsPage
