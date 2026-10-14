import { useStoreName } from '../store/renderer.js'

export function useUserinfo() {
  let { data, set } = useStoreName('userinfo')
  return {
    data,
    logout: () => {
      set(null)
    }
  }
}
