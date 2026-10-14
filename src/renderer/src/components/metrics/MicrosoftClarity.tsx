import { useEffect } from 'react'

const MicrosoftClarity = ({ microsoftClarityId }) => {
  useEffect(() => {
    if (microsoftClarityId?.length) {
      const LoadExternalScript = () => {
        const externalScript = document.createElement('script')
        externalScript.onerror = loadError
        externalScript.id = 'microsoft-clarity-init'
        externalScript.async = true
        externalScript.type = 'text/javascript'
        externalScript.setAttribute('crossorigin', 'anonymous')
        document.body.appendChild(externalScript)
        externalScript.innerHTML = `
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "${microsoftClarityId}");
        `
      }
      LoadExternalScript()
    }
  }, [microsoftClarityId])
  return <></>
}

function loadError(onError) {
  console.error(`Failed ${onError.target.src} didn't load correctly`)
}

export default MicrosoftClarity
