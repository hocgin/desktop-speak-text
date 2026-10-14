/// https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app
/// https://tobias-sample.co.uk/how-to-get-deep-linking-to-work-in-electron-on-linux
import path from 'path'
import { supportProtocol } from './config.js'

type Query = Record<string, string>
export type Listener = (query: Query) => any

const protocols = supportProtocol

class ListenersMap {
  private map: Map<string, Set<Listener>> = new Map()

  add(action: string, listener: Listener) {
    if (!this.map.has(action)) {
      this.map.set(action, new Set())
    }
    this.map.get(action)!.add(listener)

    return this.map.get(action)!.size
  }

  remove(action: string, listener: Listener) {
    const listeners = this.map.get(action)
    if (!listeners) return 0

    listeners.delete(listener)

    if (listeners.size === 0) {
      this.map.delete(action)
      return 0
    }

    return listeners.size
  }

  emit(action: string, query: Query | any) {
    const actionListeners = this.map.get(action)
    if (!actionListeners) return 0

    actionListeners.forEach((listener) => listener(query))

    return actionListeners.size
  }
}

const listeners = new ListenersMap()

const deepLink = {
  on: (event: string, listener: Listener) => {
    const count = listeners.add(event, listener)
    console.info(`Deep link: listener added for event ${event}. Total event listeners: ${count}`)
  },
  off: (event: string, listener: Listener) => {
    const count = listeners.remove(event, listener)
    console.info(`Deep link: listener removed for event ${event}. Total event listeners: ${count}`)
  },
  once: (event: string, listener: Listener) => {
    const onceListener: Listener = (query) => {
      deepLink.off(event, onceListener)
      listener(query)
    }
    deepLink.on(event, onceListener)
  }
}

function registerDeeplinkProtocol(app: Electron.App) {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('myapp', process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient('myapp')
  }
}

function registerDeeplinkHandle(app: Electron.App) {
  const singleInstanceLock = app.requestSingleInstanceLock()
  if (!singleInstanceLock) {
    app.quit()
  } else {
    app.on('second-instance', (_e, commandLine) => {
      const target = commandLine.find((arg) =>
        protocols.some((protocol) => arg.startsWith(protocol + '://'))
      )
      if (!target) return
      try {
        const url = new URL(target)

        const action = url.hostname
        console.info(`Deep link: action found: ${action}`)

        const query: Query = {}
        url.searchParams.forEach((value, key) => {
          query[key] = value
        })
        console.info(`Deep link: query found: ${JSON.stringify(query)}`)

        const emitCount = listeners.emit(action, query)
        console.info(`Deep link: emitted for ${emitCount} listeners`)
      } catch (error) {
        console.error(`Deep link: error parsing URL: ${error}`)
      }
    })
  }
}

export { deepLink, registerDeeplinkProtocol, registerDeeplinkHandle }
