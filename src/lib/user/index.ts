import { decode } from './jwt/jwt.js'

export class TokenKit {
  static SECURE_TOKEN_COOKIE_NAME = '__Secure-authjs.session-token'
  public static AUTHORIZATION_NAME = 'Authorization'
  static TOKEN_QUERY_NAME = 'token'

  static getBearerToken(bearerToken?: string) {
    if (!bearerToken) return bearerToken
    if (bearerToken.startsWith(`Bearer`)) {
      return bearerToken.replaceAll('Bearer', '').trim()
    }
    return undefined
  }

  static isAjax(headers: Headers) {
    return `XMLHttpRequest` === headers.get(`X-Requested-With`)
  }

  static async decode({
    token,
    secret = 'hocgin',
    salt = TokenKit.SECURE_TOKEN_COOKIE_NAME
  }: {
    token: string
    secret?: string
    salt?: string
  }) {
    return (await decode({ token, secret, salt })) as any
  }
}
