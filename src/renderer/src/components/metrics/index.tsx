import MicrosoftClarity from './MicrosoftClarity.js'

const Metrics = () => (
  <>
    <MicrosoftClarity microsoftClarityId={`${import.meta.env.RENDERER_VITE_MICROSOFT_CLARITY}`} />
  </>
)

export default Metrics
