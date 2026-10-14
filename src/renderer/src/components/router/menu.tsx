import { LocalRoute } from '@/renderer/components/router/type.js'
import memoizeOne from 'memoize-one'
import React, { useMemo } from 'react'
import { useRoutesData } from '@/renderer/components/router/routes.js'

export type MenuItem = {
  key: string
  label?: React.ReactNode
  icon?: React.ReactElement
  children?: MenuItem[]
  [k: string]: any
}

// @ts-ignore
export let fastGetMenuDataItem = memoizeOne(getMenuDataItem)

function getMenuDataItem(routes: LocalRoute[], accesss: string[]): MenuItem[] {
  // 过滤有权限的菜单
  let routeMap = asRouteMap(routes)
  Object.values(routeMap)
    .filter(({ access }) => (access && accesss.includes(access)) || accesss.includes('*'))
    .forEach((item) => {
      item.hasAccess = true
      item.parentKeys?.forEach((key) => {
        routeMap[key].hasAccess = true
      })
    })
  // 构建树型菜单
  return fastRoutesToMenuDataItems(routes ?? [], accesss)
}

// @ts-ignore
let fastRoutesToMenuDataItems = memoizeOne(routesToMenuDataItems)

function routesToMenuDataItems(routes: LocalRoute[], accesss: string[]): MenuItem[] {
  return (routes || [])
    .filter(({ hasAccess }) => hasAccess)
    .map((route) => {
      let result: MenuItem = asMenuDataItem(route)
      let children = routesToMenuDataItems(route?.routes || [], accesss)
      // @ts-ignore
      result.children = children.length ? children : undefined
      return result
    })
}

function asRouteMap(routes: LocalRoute[]): Record<string, LocalRoute> {
  const routeMap: Record<string, LocalRoute> = {}
  const mergeMenuAndRouter = (data: LocalRoute[]) => {
    ;(data || []).forEach((item: LocalRoute) => {
      item.key = `${item.path}`
      if (item.routes) {
        mergeMenuAndRouter(item.routes)
        item.routes.forEach((x: LocalRoute) => {
          x.parentKeys = [...(item.parentKeys || []), item.key!]
        })
      }
      routeMap[`${item.key}`] = item
    })
  }
  mergeMenuAndRouter(routes)
  return routeMap
}

function getIcon(icon: string | React.ReactElement | undefined): React.ReactElement | undefined {
  if (!icon) {
    return undefined
  }
  if (typeof icon === 'string') {
    return <></>
  }
  return icon
}

function asMenuDataItem({
  key,
  path,
  icon,
  title,
  hideChildrenInMenu,
  hideInMenu,
  access,
  parentKeys
}: LocalRoute): MenuItem {
  return {
    hideChildrenInMenu: hideChildrenInMenu ?? false,
    hideInMenu: hideInMenu ?? false,
    name: title,
    title: title,
    label: title, //ok
    key: key ?? '',
    icon: getIcon(icon),
    path: path,
    access: access,
    parentKeys: parentKeys,
    children: []
  } as any
}

export function routesToAccess(routes: LocalRoute[]): string[] {
  return (routes || [])
    .flatMap(({ access, routes = [] }) => {
      if (!access) {
        return [...routesToAccess(routes)]
      }
      return [access, ...routesToAccess(routes)]
    })
    .filter((i) => i !== null)
}

// @ts-ignore
export let fastGetAccess = memoizeOne(getAccess)

/**
 * 把路由 access 提取出来
 * @param routes
 */
function getAccess(routes: LocalRoute = [] as any): string[] {
  return (routes || [])
    .flatMap(({ access, routes = [] }: LocalRoute) => {
      return [access, ...getAccess(routes as any)]
    })
    .filter((i: string) => i !== null)
}

function getRouteMenu(
  routes: LocalRoute[] = [],
  access: string[] = [],
  isShowAll: boolean = false
) {
  if (isShowAll) {
    return fastGetMenuDataItem(routes, ['*'])
  } else {
    return fastGetMenuDataItem(routes, access) ?? []
  }
}

// @ts-ignore
export const fastGetRouteMenu = memoizeOne(getRouteMenu) as typeof getRouteMenu

export function useMenuData(id: string) {
  let routesData = useRoutesData(id)
  let data = useMemo(() => {
    return fastGetRouteMenu(routesData?.[0].routes ?? [], [], true)
  }, [routesData])
  return data
}
