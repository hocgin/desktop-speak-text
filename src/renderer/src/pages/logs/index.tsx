import React, { useEffect, useRef } from 'react'
import styles from './index.module.css'
import { Container } from '@/renderer/components/container/index.js'
import clsx from 'clsx'

function LogsPage(): React.JSX.Element {
  // @ts-ignore
  const ref = useRef<HTMLPreElement>()
  function append(str: string) {
    if (!ref.current) return;
    ref.current.textContent += str
    ref.current.scrollTo(0, ref.current.scrollHeight)
  }
  useEffect(()=>{
    window.electron.shell.getLog()
    window.electron.shell.onUpdate(data => append(data))
  }, [])
  return (
    <Container className={clsx(styles.body)}>
      <pre ref={ref} style={{ width: '100%', height: '100vh', overflow: 'auto' }} onClick={()=>{
        // instance?.writeln("ls -la")
        window.electron.shell.exec("ls -la")
      }}></pre>
    </Container>
  )
}

export default LogsPage



