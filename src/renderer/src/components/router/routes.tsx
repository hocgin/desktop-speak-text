import { Route } from 'react-router-dom'

import { Router } from '@/lib/electron-router-dom.js'
import routes from '@/renderer/router.config.js'
import { LocalRoute } from './type.js'
import { useMemo } from 'react'

export function Routes() {
  let routesProps = useMemo(() => {
    return Object.fromEntries(
      Object.entries(routes).map(([key, value]) => {
        return [key, createRouter(value)]
      })
    ) as Record<string, LocalRoute[]>
  }, [routes])
  return (
    <Router
      {...routesProps}
      _providerProps={{
        fallbackElement: <div>Loading...</div>
      }}
    />
  )
}

function createRouter(routes: LocalRoute[] = []) {
  let createRoute = (routes) =>
    routes.map((route, i) => {
      return (
        <Route
          key={i}
          path={route.path}
          Component={route.component}
          errorElement={route.errorComponent}
          action={route.action}
        >
          {route.routes?.length ? createRoute(route.routes) : <></>}
        </Route>
      )
    })
  return createRoute(routes)
}

export function useRoutesData(id: string) {
  return routes[id] as LocalRoute[]
}
