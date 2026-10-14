import { useChanger } from './useChanger.js'

export default function LanguageChanger() {
  let { currentLocale, changeLocale, loading, supportLocales } = useChanger()
  const handleChange = (e) => {
    const newLocale = e.target.value
    changeLocale(newLocale)
  }

  return (
    <select disabled={loading} onChange={handleChange} value={currentLocale}>
      {supportLocales.map((lng) => (
        <option key={lng} value={lng}>
          {lng}
        </option>
      ))}
    </select>
  )
}
