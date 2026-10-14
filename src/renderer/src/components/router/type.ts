import React from 'react'

export interface LocalRoute {
  /**
   * 权限码
   */
  access?: string
  /**
   * 菜单名称
   */
  title?: string
  /**
   * 图标信息
   */
  component: React.ReactElement | undefined | any
  errorComponent: React.ReactElement | undefined | any
  action: any
  icon: string | React.ReactElement | undefined
  /**
   * 路径
   */
  path?: string
  /**
   * 是否隐藏子菜单
   */
  hideChildrenInMenu?: boolean
  /**
   * 是否隐藏菜单
   */
  hideInMenu?: boolean
  /**
   * 子路由
   */
  routes?: LocalRoute[]
  /**
   * [非初始化] key
   */
  key?: string
  /**
   * [非初始化] 父级 KEY
   */
  parentKeys?: string[]
  /**
   * [非初始化] 有权限的菜单
   */
  hasAccess?: boolean

  [key: string]: any
}
