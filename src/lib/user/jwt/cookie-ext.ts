export function defaultCookies(useSecureCookies: boolean) {
  const cookiePrefix = useSecureCookies ? "__Secure-" : ""
  return {
    // default cookie options
    sessionToken: {
      name: `${cookiePrefix}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}authjs.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      // Default to __Host- for CSRF token for additional protection if using useSecureCookies
      // NB: The `__Host-` prefix is stricter than the `__Secure-` prefix.
      name: `${useSecureCookies ? "__Host-" : ""}authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    pkceCodeVerifier: {
      name: `${cookiePrefix}authjs.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15, // 15 minutes in seconds
      },
    },
    state: {
      name: `${cookiePrefix}authjs.state`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15, // 15 minutes in seconds
      },
    },
    nonce: {
      name: `${cookiePrefix}authjs.nonce`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    webauthnChallenge: {
      name: `${cookiePrefix}authjs.challenge`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15, // 15 minutes in seconds
      },
    },
  } as any
}

const ALLOWED_COOKIE_SIZE = 4096
// Based on commented out section above
const ESTIMATED_EMPTY_COOKIE_SIZE = 160
const CHUNK_SIZE = ALLOWED_COOKIE_SIZE - ESTIMATED_EMPTY_COOKIE_SIZE

export class SessionStore {
  #chunks: any = {}
  #option: any
  #logger: Console

  constructor(
    option: any,
    cookies: any,
    logger: Console
  ) {
    this.#logger = logger
    this.#option = option
    if (!cookies) return

    const {name: sessionCookiePrefix} = option

    for (const [name, value] of Object.entries(cookies)) {
      if (!name.startsWith(sessionCookiePrefix) || !value) continue
      this.#chunks[name] = value
    }
  }

  /**
   * The JWT Session or database Session ID
   * constructed from the cookie chunks.
   */
  get value() {
    // Sort the chunks by their keys before joining
    const sortedKeys = Object.keys(this.#chunks).sort((a, b) => {
      const aSuffix = parseInt(a.split(".").pop() || "0")
      const bSuffix = parseInt(b.split(".").pop() || "0")

      return aSuffix - bSuffix
    })

    // Use the sorted keys to join the chunks in the correct order
    return sortedKeys.map((key) => this.#chunks[key]).join("")
  }

  /** Given a cookie, return a list of cookies, chunked to fit the allowed cookie size. */
  #chunk(cookie: any): any[] {
    const chunkCount = Math.ceil(cookie.value.length / CHUNK_SIZE)

    if (chunkCount === 1) {
      this.#chunks[cookie.name] = cookie.value
      return [cookie]
    }

    const cookies: any[] = []
    for (let i = 0; i < chunkCount; i++) {
      const name = `${cookie.name}.${i}`
      const value = cookie.value.substr(i * CHUNK_SIZE, CHUNK_SIZE)
      cookies.push({...cookie, name, value})
      this.#chunks[name] = value
    }

    this.#logger.debug("CHUNKING_SESSION_COOKIE", {
      message: `Session cookie exceeds allowed ${ALLOWED_COOKIE_SIZE} bytes.`,
      emptyCookieSize: ESTIMATED_EMPTY_COOKIE_SIZE,
      valueSize: cookie.value.length,
      chunks: cookies.map((c) => c.value.length + ESTIMATED_EMPTY_COOKIE_SIZE),
    })

    return cookies
  }

  /** Returns cleaned cookie chunks. */
  #clean(): Record<string, any> {
    const cleanedChunks: Record<string, any> = {}
    for (const name in this.#chunks) {
      delete this.#chunks?.[name]
      cleanedChunks[name] = {
        name,
        value: "",
        options: {...this.#option.options, maxAge: 0},
      }
    }
    return cleanedChunks
  }

  /**
   * Given a cookie value, return new cookies, chunked, to fit the allowed cookie size.
   * If the cookie has changed from chunked to unchunked or vice versa,
   * it deletes the old cookies as well.
   */
  chunk(value: string, options: Partial<any>): any[] {
    // Assume all cookies should be cleaned by default
    const cookies: Record<string, any> = this.#clean()

    // Calculate new chunks
    const chunked = this.#chunk({
      name: this.#option.name,
      value,
      options: {...this.#option.options, ...options},
    })

    // Update stored chunks / cookies
    for (const chunk of chunked) {
      cookies[chunk.name] = chunk
    }

    return Object.values(cookies)
  }

  /** Returns a list of cookies that should be cleaned. */
  clean(): any[] {
    return Object.values(this.#clean())
  }
}
