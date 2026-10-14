import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLogin } from './useLogin.js'

export default function () {
  const { t } = useTranslation()
  return (
    <>
      {t('login.text')}
      <NavLink to={'/'}>{t('login.back')}</NavLink>
    </>
  )
}
