import { Link } from 'react-router-dom'

export function GlobalError() {
  return (
    <>
      <h1>Error</h1>
      <Link
        to={{
          pathname: '/',
          search: location.search
        }}
      >
        Back to Home
      </Link>
    </>
  )
}

export default GlobalError
