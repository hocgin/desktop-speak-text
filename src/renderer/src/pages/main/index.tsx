import React from 'react'
import './index.css'
import styles from './index.module.css'
import { Container } from '@/renderer/components/container/index.js'
import clsx from 'clsx'

function App(): React.JSX.Element {
  return (
    <Container className={clsx(styles.body)}>
      <webview src={"https://logspot.hocgin.top"} style={{height: '100%', width: "100%"}}/>
    </Container>
  )
}

export default App
